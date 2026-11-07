import { and, asc, count, desc, eq, ilike, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import {
  isToolKind,
  TOOL_ADMIN_STATUSES,
  TOOL_KINDS,
  type ToolAdminStatus,
  toolSiteUrl,
  type ToolInput,
  type ToolKind,
  type ToolRemovalReason,
} from '../../tools/schema';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { publicName } from '../db/public-name';
import { gameTablePlatforms, gameTables, platforms, profiles, tools } from '../db/schema';
import { escapeLike, openSql, published } from '../directories/sql';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import type { Changes } from '../events/types';
import { enforceRateLimit, TOOL_LIMIT } from '../rate-limit';
import { nextFreeSlug, slugify } from '../../slug';

// "Ferramentas" (/tools): the platforms and apps tables use. A member suggests one, it waits for an
// admin (`approvedAt`), and an admin edits, approves, turns down or removes it. Who suggested it is
// for admins only. Errors are codes only; the web app words them.

const MAX_SLUG_ATTEMPTS = 5;
/** `/tools/new` is the form. */
const RESERVED_TOOL_SLUGS: ReadonlySet<string> = new Set(['new']);

/** A Postgres unique violation, and on which index (drizzle wraps the driver's error as `cause`). */
function conflictOn(error: unknown): string | null {
  const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
    error) as Record<string, string | undefined>;
  return code === '23505' ? `${constraint_name ?? constraint ?? message}` : null;
}

/** The columns an add or an edit writes, from a validated form. */
function columnsOf(input: ToolInput) {
  const siteUrl = toolSiteUrl(input.siteUrl);
  if (!siteUrl) throw new Invalid('siteUrl', 'invalid_url');
  if (!isToolKind(input.kind)) throw new Invalid('kind', 'required');
  return {
    name: input.name.trim(),
    kind: input.kind,
    siteUrl,
    description: input.description.trim(),
  };
}

/** A tool on the page (or waiting, for whoever suggested it). */
export type ToolCard = {
  id: string;
  slug: string;
  name: string;
  kind: ToolKind;
  siteUrl: string;
  description: string;
  logoPath: string | null;
  /** The table platform it is, for the "N mesas abertas" link; null when it is not one. */
  platformSlug: string | null;
  /** Open tables that play on it. */
  openTables: number;
  /** Waiting for an admin: only whoever suggested it sees it. */
  pending: boolean;
};

/**
 * The page: the approved tools, grouped by kind in TOOL_KINDS order and by name inside each, plus
 * the viewer's own suggestions that still wait. `query` narrows by name or description.
 */
export async function listTools(
  db: AnyDb,
  {
    viewerId = null,
    query = '',
    now = new Date(),
  }: { viewerId?: string | null; query?: string; now?: Date } = {},
) {
  const needle = query.trim() ? `%${escapeLike(query.trim())}%` : null;
  const open = db
    .select({
      platformId: gameTablePlatforms.platformId,
      open: sql<number>`count(*)::int`.as('open'),
    })
    .from(gameTablePlatforms)
    .innerJoin(gameTables, eq(gameTables.id, gameTablePlatforms.tableId))
    .where(and(published, openSql(now)))
    .groupBy(gameTablePlatforms.platformId)
    .as('open_tables');

  const rows = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      kind: tools.kind,
      siteUrl: tools.siteUrl,
      description: tools.description,
      logoPath: tools.logoPath,
      platformSlug: platforms.slug,
      openTables: sql<number>`coalesce(${open.open}, 0)`.mapWith(Number),
      pending: sql<boolean>`${tools.approvedAt} IS NULL`,
    })
    .from(tools)
    .leftJoin(platforms, and(eq(platforms.id, tools.platformId), eq(platforms.status, 'approved')))
    .leftJoin(open, eq(open.platformId, tools.platformId))
    .where(
      and(
        isNull(tools.removedAt),
        viewerId
          ? or(isNotNull(tools.approvedAt), eq(tools.submitterId, viewerId))
          : isNotNull(tools.approvedAt),
        needle ? or(ilike(tools.name, needle), ilike(tools.description, needle)) : undefined,
      ),
    )
    .orderBy(asc(sql`lower(${tools.name})`), asc(tools.id));

  const cards = rows.map((row) => ({ ...row, kind: row.kind as ToolKind })) as ToolCard[];
  return {
    query: query.trim(),
    pending: cards.filter((card) => card.pending),
    groups: TOOL_KINDS.map((kind) => ({
      kind,
      tools: cards.filter((card) => !card.pending && card.kind === kind),
    })).filter((group) => group.tools.length > 0),
  };
}

export type ToolList = Awaited<ReturnType<typeof listTools>>;

/** The tool already up at this site, if any: a repeat suggestion points at it. */
async function refuseDuplicate(db: AnyDb, siteUrl: string, exceptId?: string) {
  const [row] = await db
    .select({ id: tools.id })
    .from(tools)
    .where(
      and(
        eq(sql`lower(${tools.siteUrl})`, siteUrl.toLowerCase()),
        isNull(tools.removedAt),
        exceptId ? sql`${tools.id} <> ${exceptId}` : undefined,
      ),
    );
  if (row) throw new Invalid('siteUrl', 'tool_duplicate');
}

/**
 * A member suggests a tool: it waits for an admin, credited to them (only admins see who). Refused
 * past TOOL_LIMIT and for a site that is already on the list (`tool_duplicate`). Returns the
 * `ToolSuggested` event to dispatch.
 */
export async function suggestTool(
  db: AnyDb,
  actor: Actor | null,
  input: ToolInput,
  { logoPath = null, now = new Date() }: { logoPath?: string | null; now?: Date } = {},
): Promise<{ id: string; eventId: string }> {
  authorize(actor, 'tool:suggest');
  const columns = columnsOf(input);
  await refuseDuplicate(db, columns.siteUrl);

  const base = slugify(columns.name, { fallback: 'ferramenta' });
  for (let attempt = 1; ; attempt++) {
    const taken = new Set(
      (
        await db
          .select({ slug: tools.slug })
          .from(tools)
          .where(like(tools.slug, `${base}%`))
      ).map((row) => row.slug),
    );
    const slug = nextFreeSlug(
      base,
      (candidate) => RESERVED_TOOL_SLUGS.has(candidate) || taken.has(candidate),
    );
    try {
      return await db.transaction(async (tx) => {
        const t = tx as unknown as AnyDb;
        await enforceRateLimit(t, actor!.id, TOOL_LIMIT, now);
        const [row] = await t
          .insert(tools)
          .values({
            slug,
            submitterId: actor!.id,
            logoPath,
            ...columns,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: tools.id });
        const eventId = await recordEvent(
          t,
          {
            type: 'ToolSuggested',
            actorId: actor!.id,
            payload: { toolId: row.id, name: columns.name },
          },
          { now },
        );
        return { id: row.id, eventId };
      });
    } catch (error) {
      const index = conflictOn(error);
      if (index?.includes('site')) throw new Invalid('siteUrl', 'tool_duplicate');
      if (index?.includes('slug') && attempt < MAX_SLUG_ATTEMPTS) continue;
      throw error;
    }
  }
}

// ---- the admin side ---------------------------------------------------------------------------

/** How many suggestions wait for an admin, for the count beside "Ferramentas" in the admin menu. */
export async function pendingToolCount(db: AnyDb): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(tools)
    .where(and(isNull(tools.approvedAt), isNull(tools.removedAt)));
  return pending;
}

/**
 * Every tool for `/admin/tools`, those that wait first, then the newest. `status` and `q` narrow
 * the list; there are few enough that it is one page.
 */
export async function listAdminTools(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const asked = params.get('status');
  const status: ToolAdminStatus = TOOL_ADMIN_STATUSES.find((value) => value === asked) ?? 'all';
  const query = (params.get('q') ?? '').trim().slice(0, 100);
  const needle = query ? `%${escapeLike(query)}%` : null;
  const rows = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      kind: tools.kind,
      siteUrl: tools.siteUrl,
      description: tools.description,
      logoPath: tools.logoPath,
      createdAt: tools.createdAt,
      approvedAt: tools.approvedAt,
      removedAt: tools.removedAt,
      removalReason: tools.removalReason,
      submitterId: tools.submitterId,
      submitter: sql<
        string | null
      >`case when ${tools.submitterId} is null then null else ${publicName(profiles.username)} end`,
    })
    .from(tools)
    .leftJoin(profiles, eq(profiles.id, tools.submitterId))
    .where(
      and(
        status === 'pending'
          ? and(isNull(tools.approvedAt), isNull(tools.removedAt))
          : status === 'up'
            ? and(isNotNull(tools.approvedAt), isNull(tools.removedAt))
            : status === 'removed'
              ? isNotNull(tools.removedAt)
              : undefined,
        needle ? or(ilike(tools.name, needle), ilike(tools.siteUrl, needle)) : undefined,
      ),
    )
    .orderBy(
      sql`case when ${tools.approvedAt} is null and ${tools.removedAt} is null then 0 else 1 end`,
      desc(tools.createdAt),
      asc(sql`lower(${tools.name})`),
    );
  return {
    rows: rows.map((row) => ({ ...row, kind: row.kind as ToolKind })),
    total: rows.length,
    status,
    query,
  };
}

export type AdminTools = Awaited<ReturnType<typeof listAdminTools>>;

/** A tool as the admin's edit form needs it. */
export async function findToolForAdmin(db: AnyDb, actor: Actor | null, id: string) {
  authorize(actor, 'moderation:manage');
  const [row] = await db
    .select({
      id: tools.id,
      name: tools.name,
      kind: tools.kind,
      siteUrl: tools.siteUrl,
      description: tools.description,
      logoPath: tools.logoPath,
      approvedAt: tools.approvedAt,
      removedAt: tools.removedAt,
    })
    .from(tools)
    .where(eq(tools.id, id));
  if (!row) throw new NotFound(`no tool "${id}"`);
  return row;
}

/**
 * An admin edits a tool (the name, site, kind, line or logo). It keeps its place: an approved tool
 * stays up and a suggestion keeps waiting. A new logo replaces the old one; the replaced path is
 * returned so the caller can delete that file. Returns the `ToolUpdated` event.
 */
export async function updateTool(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  input: ToolInput,
  { logoPath = null, now = new Date() }: { logoPath?: string | null; now?: Date } = {},
): Promise<{ eventId: string; replacedLogo: string | null }> {
  authorize(actor, 'moderation:manage');
  const next = columnsOf(input);
  await refuseDuplicate(db, next.siteUrl, id);
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [current] = await t.select().from(tools).where(eq(tools.id, id)).for('update');
    if (!current) throw new Invalid('id', 'not_found');
    if (current.removedAt) throw new Invalid('id', 'closed');

    const changes: Changes = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (next[key] !== current[key]) changes[key] = { from: current[key], to: next[key] };
    }
    if (logoPath) changes.logo = { redacted: true };

    await t
      .update(tools)
      .set({ ...next, ...(logoPath ? { logoPath } : {}), updatedAt: now })
      .where(eq(tools.id, id));
    const eventId = await recordEvent(
      t,
      {
        type: 'ToolUpdated',
        actorId: actor!.id,
        payload: { toolId: id, name: next.name, changes },
      },
      { now },
    );
    return { eventId, replacedLogo: logoPath ? current.logoPath : null };
  });
}

/**
 * An admin approves a suggestion: it goes on the page and whoever suggested it is told
 * (`ToolApproved`). Refused for one already approved (`already_approved`), taken off (`closed`)
 * or unknown (`not_found`). Returns the events to dispatch.
 */
export async function approveTool(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [tool] = await t.select().from(tools).where(eq(tools.id, id)).for('update');
    if (!tool) throw new Invalid('id', 'not_found');
    if (tool.removedAt) throw new Invalid('id', 'closed');
    if (tool.approvedAt) throw new Invalid('id', 'already_approved');
    await t.update(tools).set({ approvedAt: now, approvedBy: actor!.id }).where(eq(tools.id, id));
    return [
      await recordEvent(
        t,
        {
          type: 'ToolApproved',
          actorId: actor!.id,
          payload: { toolId: id, name: tool.name, submitterId: tool.submitterId },
        },
        { now },
      ),
    ];
  });
}

/**
 * An admin turns a suggestion down or takes a tool off the page. Whoever suggested it is told why
 * (`ToolRemoved`, with the reason and the note). Refused for one already off (`closed`) or unknown
 * (`not_found`). Returns the events to dispatch.
 */
export async function removeTool(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { reason, note }: { reason: ToolRemovalReason; note: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [tool] = await t.select().from(tools).where(eq(tools.id, id)).for('update');
    if (!tool) throw new Invalid('id', 'not_found');
    if (tool.removedAt) throw new Invalid('id', 'closed');
    await t
      .update(tools)
      .set({
        removedAt: now,
        removedBy: actor!.id,
        removalReason: reason,
        removalNote: note || null,
      })
      .where(eq(tools.id, id));
    return [
      await recordEvent(
        t,
        {
          type: 'ToolRemoved',
          actorId: actor!.id,
          payload: { toolId: id, name: tool.name, submitterId: tool.submitterId, reason },
        },
        { now },
      ),
    ];
  });
}
