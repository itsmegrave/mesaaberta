import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, instagramAccounts, instagramPosts } from '../db/schema';
import type { Handler } from '../events/types';
import { backoffSeconds } from '../events/dispatcher';
import {
  configured,
  decryptToken,
  encryptToken,
  graph,
  InstagramError,
  refreshToken,
  type InstagramEnv,
} from './api';
import { renderShareImage, shareFacts } from './image';
import { createFlags } from '../flags/flags';
import { growthBookPayload } from '../flags/payload';
import { findTableBySlug } from '../tables/queries';
import { hasStarted } from '../tables/schedule';

// Always registered, even before OAuth is configured: creation events remain decoupled from Meta.
export const instagramQueueHandler: Handler = {
  name: 'instagram-queue',
  types: ['TableCreated'],
  async handle(event, db) {
    if (event.type !== 'TableCreated') return;
    await db
      .insert(instagramPosts)
      .values({ tableId: event.payload.tableId, eventId: event.id })
      .onConflictDoNothing();
  },
};
const DAY = 24 * 3600_000;
const MAX_ATTEMPTS = 12;
const LEASE_MS = 10 * 60_000;
const terminal = ['published', 'failed', 'uncertain', 'skipped'];
type Post = typeof instagramPosts.$inferSelect;

type Deps = {
  useTableImage?: boolean;
  render?: typeof renderShareImage;
  api?: typeof graph;
  refresh?: typeof refreshToken;
};
/**
 * At-most-once publishing: save the container, and persist `publishing` BEFORE the external write.
 * If the Worker dies or the response is lost there, never repeat media_publish. An admin must
 * reconcile the outcome with Meta. Container creation can be repeated safely (it posts nothing).
 */
export async function processPost(
  db: AnyDb,
  env: InstagramEnv,
  post: Post,
  token: string,
  userId: string,
  now: Date,
  { render = renderShareImage, api = graph, useTableImage }: Deps = {},
) {
  const save = async (values: Partial<typeof instagramPosts.$inferInsert>) => {
    await db.update(instagramPosts).set(values).where(eq(instagramPosts.tableId, post.tableId));
    Object.assign(post, values);
  };
  // A previous publish may have completed even if its response never reached us.
  if (post.status === 'publishing') {
    await save({ status: 'uncertain', lastError: 'publish_outcome_unknown' });
    return;
  }
  // Media id was committed; only the read of its permalink remains. Never publish again.
  if (post.mediaId) {
    const media = await api<{ permalink: string }>(env, token, post.mediaId, {
      fields: 'permalink',
    });
    await save({ status: 'published', permalink: media.permalink, image: null, lastError: null });
    return;
  }
  const [row] = await db
    .select({ slug: gameTables.slug })
    .from(gameTables)
    .where(eq(gameTables.id, post.tableId));
  const table = row ? await findTableBySlug(db, row.slug, now) : null;
  if (!table || hasStarted(table.startsAt, now)) {
    await save({ status: 'skipped', image: null });
    return;
  }
  if (post.accountId && post.accountId !== userId) {
    await save({ status: 'failed', image: null, lastError: 'account_changed' });
    return;
  }
  if (!post.image) {
    const includePhoto =
      useTableImage ??
      (await createFlags(
        env.GROWTHBOOK_API_HOST && env.GROWTHBOOK_CLIENT_KEY
          ? growthBookPayload({
              apiHost: env.GROWTHBOOK_API_HOST,
              clientKey: env.GROWTHBOOK_CLIENT_KEY,
              fetch,
              waitUntil: () => {},
            })
          : async () => null,
      ).isEnabled('use_table_image'));
    const image = await render(table, env, { useTableImage: includePhoto });
    const caption = shareFacts(table, env.APP_ORIGIN!).caption;
    if (caption.length > 2200) throw new InstagramError(400, false);
    await save({
      image: Buffer.from(image).toString('base64'),
      caption,
      assetExpiresAt: new Date(now.getTime() + DAY),
      accountId: userId,
      status: 'processing',
    });
  }
  if (post.assetExpiresAt && post.assetExpiresAt <= now) {
    await save({ status: 'failed', image: null, lastError: 'asset_expired' });
    return;
  }
  if (!post.containerId) {
    const container = await api<{ id: string }>(
      env,
      token,
      `${userId}/media`,
      {
        image_url: new URL(`/instagram/assets/${post.assetKey}`, env.APP_ORIGIN!).href,
        caption: post.caption!,
      },
      'POST',
    );
    if (!container.id) throw new Error('Instagram container response invalid');
    await save({ containerId: container.id });
  }
  const container = await api<{ status_code: string }>(env, token, post.containerId!, {
    fields: 'status_code',
  });
  if (container.status_code === 'ERROR' || container.status_code === 'EXPIRED') {
    await save({
      status: 'failed',
      image: null,
      lastError: `container_${container.status_code.toLowerCase()}`,
    });
    return;
  }
  if (container.status_code === 'PUBLISHED') {
    await save({ status: 'uncertain', lastError: 'publish_outcome_unknown' });
    return;
  }
  if (container.status_code === 'IN_PROGRESS') {
    await save({
      status: 'processing',
      nextAttemptAt: new Date(now.getTime() + 60_000),
      lastError: null,
    });
    return;
  }
  if (container.status_code !== 'FINISHED') throw new Error('Instagram container response invalid');
  await save({ status: 'publishing' });
  try {
    const result = await api<{ id: string }>(
      env,
      token,
      `${userId}/media_publish`,
      { creation_id: post.containerId! },
      'POST',
    );
    if (!result.id) throw new Error('Instagram publish response invalid');
    await save({ mediaId: result.id, status: 'processing', image: null });
  } catch (error) {
    // A permanent API refusal fails the job. Transient publish errors, timeouts and crashes
    // can conceal a completed write, so they require reconciliation rather than another POST.
    if (error instanceof InstagramError)
      await save({ status: error.retryable ? 'uncertain' : 'failed' });
    else await save({ status: 'uncertain', lastError: 'publish_outcome_unknown' });
    throw error;
  }
  const media = await api<{ permalink: string }>(env, token, post.mediaId!, {
    fields: 'permalink',
  });
  await save({ status: 'published', permalink: media.permalink, lastError: null });
}

/** Runs from the cron, using the same database connection as the event sweeper. */
export async function publishInstagramPosts(
  db: AnyDb,
  env: InstagramEnv | undefined,
  now = new Date(),
  deps: Deps = {},
): Promise<number> {
  // Delete expired capability assets, including ambiguous or exhausted jobs.
  await db
    .update(instagramPosts)
    .set({ image: null })
    .where(lte(instagramPosts.assetExpiresAt, now));
  if (!configured(env)) return 0;
  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  if (!account || account.expiresAt <= now) return 0;
  let token = await decryptToken(account.token, env!.INSTAGRAM_TOKEN_KEY!);
  if (account.expiresAt.getTime() - now.getTime() < 7 * DAY) {
    const refreshed = await (deps.refresh ?? refreshToken)(token);
    token = refreshed.access_token;
    await db
      .update(instagramAccounts)
      .set({
        token: await encryptToken(token, env!.INSTAGRAM_TOKEN_KEY!),
        expiresAt: new Date(now.getTime() + refreshed.expires_in * 1000),
      })
      .where(eq(instagramAccounts.id, account.id));
  }
  const due = and(
    inArray(instagramPosts.status, ['queued', 'processing', 'publishing']),
    lte(instagramPosts.nextAttemptAt, now),
    or(isNull(instagramPosts.claimedUntil), lte(instagramPosts.claimedUntil, now)),
  );
  const rows = await db
    .select({ tableId: instagramPosts.tableId })
    .from(instagramPosts)
    .where(due)
    .orderBy(asc(instagramPosts.createdAt))
    .limit(5);
  for (const { tableId } of rows) {
    const [post] = await db
      .update(instagramPosts)
      .set({ claimedUntil: new Date(now.getTime() + LEASE_MS) })
      .where(and(eq(instagramPosts.tableId, tableId), due))
      .returning();
    if (!post) continue;
    try {
      await processPost(db, env!, post, token, account.userId, now, deps);
    } catch (error) {
      const attempts = post.attempts + 1;
      const failed =
        !terminal.includes(post.status) &&
        post.status !== 'publishing' &&
        (attempts >= MAX_ATTEMPTS || (error instanceof InstagramError && !error.retryable));
      await db
        .update(instagramPosts)
        .set({
          attempts,
          nextAttemptAt: new Date(now.getTime() + backoffSeconds(attempts) * 1000),
          lastError:
            post.status === 'uncertain'
              ? 'publish_outcome_unknown'
              : error instanceof InstagramError
                ? `api_${error.code}`
                : 'processing_failed',
          ...(failed ? { status: 'failed', image: null } : {}),
        })
        .where(eq(instagramPosts.tableId, tableId));
    } finally {
      await db
        .update(instagramPosts)
        .set({ claimedUntil: null })
        .where(eq(instagramPosts.tableId, tableId));
    }
  }
  return rows.length;
}

/** Persist first; rendering and Meta requests happen only in the background worker. */
export async function queueInstagramTable(
  db: AnyDb,
  env: InstagramEnv | undefined,
  tableId: string,
  now = new Date(),
) {
  if (!configured(env)) return 'unavailable';
  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  if (!account || account.expiresAt <= now) return 'unavailable';
  const [row] = await db
    .select({ slug: gameTables.slug })
    .from(gameTables)
    .where(eq(gameTables.id, tableId));
  const listed = row ? await findTableBySlug(db, row.slug, now) : null;
  if (!listed || hasStarted(listed.startsAt, now)) return 'not-eligible';
  await db
    .insert(instagramPosts)
    .values({ tableId, eventId: crypto.randomUUID(), status: 'queued', nextAttemptAt: now })
    .onConflictDoNothing();
  // A retry must never overwrite a live lease or an ambiguous/published external write.
  await db
    .update(instagramPosts)
    .set({ status: 'queued', nextAttemptAt: now, lastError: null, attempts: 0 })
    .where(
      and(
        eq(instagramPosts.tableId, tableId),
        inArray(instagramPosts.status, ['failed', 'skipped']),
        or(isNull(instagramPosts.claimedUntil), lte(instagramPosts.claimedUntil, now)),
      ),
    );
  const [post] = await db.select().from(instagramPosts).where(eq(instagramPosts.tableId, tableId));
  if (post.status === 'published') return 'already-published';
  if (['publishing', 'uncertain'].includes(post.status)) return 'uncertain';
  return 'queued';
}

/** Publishes one eligible table on an explicit admin request without draining the cron queue. */
export async function publishInstagramTable(
  db: AnyDb,
  env: InstagramEnv | undefined,
  tableId: string,
  now = new Date(),
  deps: Deps = {},
): Promise<
  'published' | 'processing' | 'uncertain' | 'unavailable' | 'not-eligible' | 'already-published'
> {
  if (!configured(env)) return 'unavailable';
  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  if (!account || account.expiresAt <= now) return 'unavailable';

  const [tableRow] = await db
    .select({ slug: gameTables.slug })
    .from(gameTables)
    .where(eq(gameTables.id, tableId));
  const table = tableRow ? await findTableBySlug(db, tableRow.slug, now) : null;
  if (!table || hasStarted(table.startsAt, now)) return 'not-eligible';

  let token = await decryptToken(account.token, env!.INSTAGRAM_TOKEN_KEY!);
  if (account.expiresAt.getTime() - now.getTime() < 7 * DAY) {
    const refreshed = await (deps.refresh ?? refreshToken)(token);
    token = refreshed.access_token;
    await db
      .update(instagramAccounts)
      .set({
        token: await encryptToken(token, env!.INSTAGRAM_TOKEN_KEY!),
        expiresAt: new Date(now.getTime() + refreshed.expires_in * 1000),
      })
      .where(eq(instagramAccounts.id, account.id));
  }

  let [post] = await db.select().from(instagramPosts).where(eq(instagramPosts.tableId, tableId));
  if (post?.status === 'published') return 'already-published';
  if (post && ['publishing', 'uncertain'].includes(post.status)) return 'uncertain';
  if (!post) {
    [post] = await db
      .insert(instagramPosts)
      .values({ tableId, eventId: crypto.randomUUID(), status: 'queued' })
      .onConflictDoNothing()
      .returning();
    if (!post) return 'already-published';
  }
  if (!['queued', 'processing', 'failed', 'skipped'].includes(post.status))
    return 'already-published';

  const [claimed] = await db
    .update(instagramPosts)
    .set({
      status: 'queued',
      claimedUntil: new Date(now.getTime() + LEASE_MS),
      nextAttemptAt: now,
      lastError: null,
    })
    .where(
      and(
        eq(instagramPosts.tableId, tableId),
        inArray(instagramPosts.status, ['queued', 'processing', 'failed', 'skipped']),
        or(isNull(instagramPosts.claimedUntil), lte(instagramPosts.claimedUntil, now)),
      ),
    )
    .returning();
  if (!claimed) return 'processing';

  try {
    await processPost(db, env!, claimed, token, account.userId, now, deps);
    if (claimed.status === 'published') return 'published';
    if (claimed.status === 'processing') return 'processing';
    if (claimed.status === 'uncertain') return 'uncertain';
    if (claimed.status === 'failed') throw new Error('Instagram container failed');
    return 'not-eligible';
  } catch (error) {
    const uncertain = claimed.status === 'publishing' || claimed.status === 'uncertain';
    const retryable = !uncertain && error instanceof InstagramError && error.retryable;
    await db
      .update(instagramPosts)
      .set({
        status: uncertain ? 'uncertain' : retryable ? 'processing' : 'failed',
        attempts: claimed.attempts + 1,
        lastError: uncertain
          ? 'publish_outcome_unknown'
          : error instanceof InstagramError
            ? `api_${error.code}`
            : 'processing_failed',
        claimedUntil: null,
        nextAttemptAt: new Date(now.getTime() + backoffSeconds(claimed.attempts + 1) * 1000),
      })
      .where(eq(instagramPosts.tableId, tableId));
    throw error;
  } finally {
    await db
      .update(instagramPosts)
      .set({ claimedUntil: null })
      .where(eq(instagramPosts.tableId, tableId));
  }
}
