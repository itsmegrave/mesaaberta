import { createClient } from '@supabase/supabase-js';
import { and, eq, isNull } from 'drizzle-orm';
import { todayIn } from '../../../crowdfunding/phase';
import { connectionStringFrom, createDb, type DatabaseEnv } from '../../db/client';
import { crowdfundings, crowdfundingImports } from '../../db/schema';
import type { Logger } from '../../logger';
import { IMAGE_BUCKET, type ImageStorage } from '../../images';
import { campaignImagePath } from '../image';
import { sourceReader } from './source-fetch';
import { sourceAdapters } from './sources';
import { checkpointRun, claimRun, finishRun, importCandidate } from './store';
import type { ImportSource, SourceAdapter, SourceCandidate, SourceReader } from './types';
export type ImportEnv = DatabaseEnv & {
  CROWDFUNDING_IMPORT_ENABLED?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};
export type RunSummary = {
  source: ImportSource;
  status: 'complete' | 'partial' | 'failed';
  imported: number;
  existing: number;
  suppressed: number;
  skipped: number;
  discovered: number;
};
type Deps = {
  scheduledTime: number;
  log: Logger;
  sources?: readonly SourceAdapter[];
  open?: typeof createDb;
  readFor?: (source: ImportSource) => SourceReader;
  clock?: () => number;
  maxDetails?: number;
  maxPages?: number;
  image?: (c: SourceCandidate) => Promise<string | null>;
  removeImage?: (path: string) => Promise<void>;
};
const cursorOf = (raw: string | null) => {
  if (!raw) return { page: 1, offset: 0 };
  const c = JSON.parse(raw) as { page: number; offset: number };
  if (
    !Number.isSafeInteger(c.page) ||
    c.page < 1 ||
    !Number.isSafeInteger(c.offset) ||
    c.offset < 0
  )
    throw new Error('source_cursor');
  return c;
};
const safeCode = (e: unknown) =>
  e instanceof Error && /^source_[a-z0-9_]{1,40}$/.test(e.message) ? e.message : 'import_failed';
/** Discovery runs once per source/local date; limits persist a cursor for the next daily run. */
export async function runDailyImports(
  env: ImportEnv,
  {
    scheduledTime,
    log,
    sources = sourceAdapters,
    open = createDb,
    readFor,
    clock = Date.now,
    maxDetails = 150,
    maxPages = 20,
    image,
    removeImage,
  }: Deps,
): Promise<RunSummary[]> {
  const connection = connectionStringFrom(env);
  if (env.CROWDFUNDING_IMPORT_ENABLED !== 'true' || !connection) {
    log.info('crowdfunding import disabled', { outcome: 'disabled' });
    return [];
  }
  const { db, close } = open(connection);
  try {
    const now = new Date(scheduledTime),
      runDate = todayIn(now),
      summaries: RunSummary[] = [];
    const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    let storage:
      | (ImageStorage & {
          remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
        })
      | undefined;
    if (env.SUPABASE_URL && key) {
      try {
        storage = createClient(env.SUPABASE_URL, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
          },
        }).storage.from(IMAGE_BUCKET);
      } catch {
        log.warn('crowdfunding image storage unavailable', { code: 'image_storage_invalid' });
      }
    }
    const saveImage =
      image ??
      ((c: SourceCandidate) => campaignImagePath(storage, { pageImageUrl: c.imageUrl, log }));
    const discardImage =
      removeImage ??
      (async (path: string) => {
        if (storage) {
          const { error } = await storage.remove([path]);
          if (error) throw new Error('image_cleanup_failed');
        }
      });
    const attachImage = async (c: SourceCandidate) => {
      let path: string | null = null;
      try {
        path = await saveImage(c);
        if (!path) return;
        const [mapping] = await db
          .select()
          .from(crowdfundingImports)
          .where(
            and(
              eq(crowdfundingImports.source, c.source),
              eq(crowdfundingImports.externalId, c.externalId),
            ),
          );
        const rows = mapping
          ? await db
              .update(crowdfundings)
              .set({ imagePath: path })
              .where(
                and(
                  eq(crowdfundings.id, mapping.crowdfundingId),
                  isNull(crowdfundings.removedAt),
                  isNull(crowdfundings.imagePath),
                ),
              )
              .returning({ id: crowdfundings.id })
          : [];
        if (!rows.length) await discardImage(path);
      } catch {
        if (path) await discardImage(path).catch(() => undefined);
        log.warn('crowdfunding image unavailable', {
          provider: c.source,
          code: 'image_unavailable',
        });
      }
    };
    for (const adapter of sources) {
      const started = clock();
      const lease = await claimRun(db, adapter.source, runDate, new Date(started));
      if (!lease) continue;
      const summary: RunSummary = {
        source: adapter.source,
        status: 'complete',
        imported: 0,
        existing: 0,
        suppressed: 0,
        skipped: 0,
        discovered: 0,
      };
      let cursor = lease.cursor,
        errorCode: string | null = null;
      try {
        let position = cursorOf(cursor),
          pages = 0,
          details = 0;
        const seenPages = new Set<number>();
        const read =
          readFor?.(adapter.source) ??
          (async (url: string) => {
            const remaining = 4 * 60_000 - (clock() - started);
            if (remaining <= 0) throw new Error('source_timeout');
            return sourceReader(adapter.source, { timeoutMs: Math.min(15_000, remaining) })(url);
          });
        for (;;) {
          cursor = JSON.stringify(position);
          if (clock() - started >= 4 * 60_000 || pages >= maxPages || details >= maxDetails) {
            summary.status = 'partial';
            break;
          }
          if (seenPages.has(position.page)) throw new Error('source_cursor');
          seenPages.add(position.page);
          const listing = await adapter.list(position.page, read);
          pages++;
          summary.discovered += Math.max(0, listing.urls.length - position.offset);
          for (let index = position.offset; index < listing.urls.length; index++) {
            cursor = JSON.stringify({ page: position.page, offset: index });
            if (clock() - started >= 4 * 60_000 || details >= maxDetails) {
              summary.status = 'partial';
              break;
            }
            let c: SourceCandidate | null;
            try {
              c = await adapter.detail(listing.urls[index], now, read);
            } catch (error) {
              // A deleted campaign is an item-level outcome. Keeping its cursor would starve
              // every later campaign forever; blocked/changed/transient pages still fail the source.
              if (!(error instanceof Error) || !/^source_http_(404|410)$/.test(error.message))
                throw error;
              log.warn('crowdfunding campaign no longer available', {
                provider: adapter.source,
                code: error.message,
              });
              c = null;
            }
            details++;
            if (!c) summary.skipped++;
            else {
              if (c.source !== adapter.source) throw new Error('source_schema');
              const outcome = await importCandidate(db, c, { now });
              summary[outcome]++;
              if (outcome === 'imported') await attachImage(c);
            }
            cursor = JSON.stringify({ page: position.page, offset: index + 1 });
            if (!(await checkpointRun(db, lease, cursor, counts(summary))))
              throw new Error('source_lease_lost');
          }
          if (summary.status === 'partial') break;
          if (listing.nextPage === null) {
            cursor = null;
            break;
          }
          if (listing.nextPage <= position.page) throw new Error('source_cursor');
          position = { page: listing.nextPage, offset: 0 };
        }
      } catch (error) {
        summary.status = 'failed';
        errorCode = safeCode(error);
      }
      const retained = await finishRun(
        db,
        lease,
        summary.status,
        cursor,
        counts(summary),
        new Date(clock()),
        errorCode,
      );
      const fields = {
        ...counts(summary),
        provider: adapter.source,
        outcome: retained ? summary.status : 'lease_lost',
        code: errorCode ?? 'none',
        requestId: lease.token,
        durationMs: clock() - started,
      };
      if (summary.status === 'failed') log.error('crowdfunding source import failed', fields);
      else log.info('crowdfunding source import', fields);
      summaries.push(summary);
    }
    return summaries;
  } finally {
    await close();
  }
}
function counts(s: RunSummary): Record<string, number> {
  return {
    discovered: s.discovered,
    imported: s.imported,
    existing: s.existing,
    suppressed: s.suppressed,
    skipped: s.skipped,
  };
}
