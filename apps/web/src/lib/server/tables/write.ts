import { and, count, eq, like, or, sql } from 'drizzle-orm';
import { addTableMember } from '../messages/service';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { gameTables, registrations, systems } from '@mesaaberta/core/server/db/schema';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import { Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { catalogOf, setTableCatalog } from '@mesaaberta/core/server/catalog';
import { diffFields, hasChanges, type Fact } from '@mesaaberta/core/server/events/changes';
import { TABLE_CREATION_LIMIT, TABLE_DRAFT_LIMIT, enforceRateLimit } from '../rate-limit';
import { instantToLocal, localToInstant } from '@mesaaberta/core/server/tables/schedule';
import { slugify, tableSlug } from '@mesaaberta/core/slug';
import { minutesToHours } from '@mesaaberta/core/tables/format';
import type { TableInput } from '$lib/tables/schema';
import { formatCep } from '$lib/location/cep';
import { NEW_CATALOG_PREFIX, SUGGESTION_NAME } from '@mesaaberta/core/tables/catalog';

const MAX_SLUG_ATTEMPTS = 5;

/** A Postgres unique violation on the slug index (drizzle wraps the driver's error as `cause`). */
function isSlugConflict(error: unknown): boolean {
  const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
    error) as Record<string, string | undefined>;

  return code === '23505' && `${constraint_name ?? constraint ?? message}`.includes('slug');
}

/** How many of one person's suggested systems may wait for an admin at the same time. */
export const SYSTEM_SUGGESTION_LIMIT = 5;

/**
 * The system a table's form picked. A pick is an approved system's slug, a pending one the GM
 * suggested, the system the table already has (`held`), or a new name (`new:<name>`, see
 * `NEW_CATALOG_PREFIX`), saved as the GM's suggestion. `waiting` says no admin has let it in yet:
 * a table with such a system stays a draft. Anything else throws `Invalid` on the field.
 *
 * Call it inside the transaction that saves the table: a new suggestion takes a lock that lasts to
 * the commit, and a save that fails must leave no suggestion behind.
 */
async function systemFor(db: AnyDb, pick: string, gmId: string, held?: string) {
  const waits = (status: string) => status === 'pending' || status === 'rejected';

  if (pick.startsWith(NEW_CATALOG_PREFIX)) {
    const name = pick.slice(NEW_CATALOG_PREFIX.length).trim().replace(/\s+/g, ' ');
    const slug = slugify(name, { fallback: '' });
    if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max || !slug) {
      throw new Invalid('systemSlug', 'suggestion_invalid');
    }
    const [existing] = await db
      .select({ id: systems.id, status: systems.status })
      .from(systems)
      .where(or(eq(systems.slug, slug), eq(sql`lower(${systems.name})`, name.toLowerCase())));
    if (existing) {
      // Turned down or retired by the moderation: it cannot come back this way.
      if (existing.status !== 'approved' && existing.status !== 'pending') {
        throw new Invalid('systemSlug', 'suggestion_unavailable');
      }
      return { id: existing.id, waiting: waits(existing.status) };
    }
    // Each suggestion is an admin's work to review: one person holds only a few at a time. The
    // lock makes two requests at once count each other.
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`system-suggestion:${gmId}`}))`);
    const [{ waiting }] = await db
      .select({ waiting: count() })
      .from(systems)
      .where(and(eq(systems.suggestedBy, gmId), eq(systems.status, 'pending')));
    if (waiting >= SYSTEM_SUGGESTION_LIMIT) throw new Invalid('systemSlug', 'suggestion_limit');
    const [created] = await db
      .insert(systems)
      .values({ name, slug, status: 'pending', suggestedBy: gmId })
      .returning({ id: systems.id });
    return { id: created.id, waiting: true };
  }

  const [system] = await db
    .select({ id: systems.id, status: systems.status, suggestedBy: systems.suggestedBy })
    .from(systems)
    .where(eq(systems.slug, pick));
  const allowed =
    system &&
    (system.status === 'approved' ||
      system.id === held ||
      (system.status === 'pending' && system.suggestedBy === gmId));
  if (!allowed) throw new Invalid('systemSlug', 'invalid');

  return { id: system.id, waiting: waits(system.status) };
}

/** The columns a form controls. Never the slug, the GM, the status or the calendar sequence. */
const catalogPicks = (input: TableInput, gmId: string) => ({
  gmId,
  platformSlugs: input.platforms,
  tagSlugs: input.tags,
});

function columnsOf(input: TableInput) {
  return {
    title: input.title,
    description: input.description,
    extraInfo: input.extraInfo,
    welcomeMessage: input.welcomeMessage,
    kind: input.kind,
    capacity: input.capacity,
    minPlayers: input.minPlayers,
    startsAt: localToInstant(input.startsAtLocal, input.timezone),
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
    recurrence: input.recurrence,
    // The whole last day counts, so it ends one minute before midnight there.
    until: input.untilLocalDate
      ? localToInstant(`${input.untilLocalDate}T23:59`, input.timezone)
      : null,
    joinMode: input.joinMode,
    modality: input.modality,
    locationArea: input.locationArea,
    joinDetails: input.joinDetails,
    postalCode: input.postalCode,
    locationNeighbourhood: input.locationNeighbourhood,
    locationCity: input.locationCity,
    locationState: input.locationState,
  };
}

/**
 * Creates a table; the creator becomes its GM. The slug comes from the title. The unique index
 * has the last word: if another request takes the slug between the check and the insert, this
 * tries the next one, so two simultaneous creates both succeed. Throws `RateLimited` past
 * `TABLE_CREATION_LIMIT`; the check runs after the form is validated, so a rejected form never
 * counts, and in the same transaction as the insert, so a refused request leaves nothing behind.
 *
 * With `draft`, the table is saved without going public: it is not listed, nobody but its GM (and
 * an admin) can open it, and nothing is posted or mailed until `publishTable`. A table whose
 * system is a suggestion no admin has approved yet is saved as a draft whatever was asked; the
 * result says so.
 */
export async function createTable(
  db: AnyDb,
  actor: Actor | null,
  input: TableInput,
  {
    now = new Date(),
    imagePath = null,
    draft = false,
  }: { now?: Date; imagePath?: string | null; draft?: boolean } = {},
): Promise<{ slug: string; eventId: string; draft: boolean }> {
  authorize(actor, 'table:create');

  const columns = { ...columnsOf(input), imagePath };
  if (columns.startsAt < now) throw new Invalid('startsAtLocal', 'in_the_past');

  const base = slugify(input.title, { fallback: 'mesa' });

  for (let attempt = 1; ; attempt++) {
    const existing = await db
      .select({ slug: gameTables.slug })
      .from(gameTables)
      .where(like(gameTables.slug, `${base}%`));
    const taken = new Set(existing.map((row) => row.slug));
    const slug = tableSlug(input.title, (candidate) => taken.has(candidate));

    try {
      // The table and its event commit together, or neither does. A slug conflict rolls both
      // back, and the retry writes a fresh pair.
      const saved = await db.transaction(async (tx) => {
        // Inside the transaction: a refused request leaves no suggestion behind either.
        const system = await systemFor(tx as unknown as AnyDb, input.systemSlug, actor!.id);
        const asDraft = draft || system.waiting;
        await enforceRateLimit(
          tx as unknown as AnyDb,
          actor!.id,
          asDraft ? TABLE_DRAFT_LIMIT : TABLE_CREATION_LIMIT,
          now,
        );

        const [created] = await tx
          .insert(gameTables)
          .values({
            ...columns,
            slug,
            gmId: actor!.id,
            systemId: system.id,
            ...(asDraft ? { status: 'draft' as const } : {}),
          })
          .returning({ id: gameTables.id });
        await setTableCatalog(tx as unknown as AnyDb, created.id, catalogPicks(input, actor!.id));
        await addTableMember(tx as unknown as AnyDb, created.id, actor!.id);

        const eventId = await recordEvent(
          tx as unknown as AnyDb,
          {
            type: asDraft ? 'TableDrafted' : 'TableCreated',
            actorId: actor!.id,
            payload: { tableId: created.id, slug, title: input.title },
          },
          { now },
        );
        return { eventId, draft: asDraft };
      });
      return { slug, ...saved };
    } catch (error) {
      if (!isSlugConflict(error) || attempt === MAX_SLUG_ATTEMPTS) throw error;
    }
  }
}

/** How many players hold a seat: a pending request takes none. */
async function seatsTakenAt(db: AnyDb, tableId: string) {
  const [row] = await db
    .select({ taken: count() })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
  return row.taken;
}

async function findForWrite(db: AnyDb, slug: string) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound(`no table with slug "${slug}"`);

  return table;
}

/** A table as the edit form shows it. Works for a disabled table too, so its GM can find it. */
export async function loadTableForEdit(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  /** The zone the GM edits in (see `timezoneOf`); the times are shown in it. */
  timezone: string,
) {
  const table = await findForWrite(db, slug);
  authorize(actor, 'table:edit', { gmId: table.gmId, tableStatus: table.status });

  const [system] = await db
    .select({ slug: systems.slug })
    .from(systems)
    .where(eq(systems.id, table.systemId));
  // The GM's own form shows the table's pending suggestions too.
  const catalog = (await catalogOf(db, [table.id], { withPending: true })).get(table.id)!;

  return {
    slug: table.slug,
    catalog,
    // The slider cannot go below them.
    seatsTaken: await seatsTakenAt(db, table.id),
    status: table.status,
    systemSlug: system.slug,
    title: table.title,
    description: table.description,
    extraInfo: table.extraInfo ?? '',
    welcomeMessage: table.welcomeMessage ?? '',
    kind: table.kind,
    capacity: table.capacity,
    minPlayers: table.minPlayers === null ? '' : String(table.minPlayers),
    startsAtLocal: instantToLocal(table.startsAt, timezone),
    timezone,
    durationHours: minutesToHours(table.durationMinutes),
    repeat:
      table.recurrence === 'FREQ=WEEKLY;INTERVAL=2' ? 'biweekly' : table.recurrence ? 'weekly' : '',
    until: table.until ? instantToLocal(table.until, timezone).slice(0, 10) : '',
    joinMode: table.joinMode,
    modality: table.modality,
    locationArea: table.locationArea ?? '',
    joinDetails: table.joinDetails ?? '',
    postalCode: table.postalCode ? formatCep(table.postalCode) : '',
    platforms: catalog.platforms.map((p) => p.slug),
    tags: catalog.tags.map((t) => t.slug),
    imagePath: table.imagePath,
  };
}

/**
 * What the players of a table see of it: what the calendar invite carries (title, text, times,
 * repetition) and where and how to join. Only a change to one of these is news for them; seats,
 * the join mode, the welcome message, the image and the tags are not.
 */
const PLAYER_FACING = [
  'title',
  'description',
  'extraInfo',
  'kind',
  'startsAt',
  'durationMinutes',
  // The invite's times are written in it.
  'timezone',
  'recurrence',
  'until',
  'modality',
  'locationArea',
  'joinDetails',
] as const;

/** The fields an edit is logged by, and the ones whose value the log never keeps. */
const AUDITED = [
  'title',
  'description',
  'extraInfo',
  'welcomeMessage',
  'kind',
  'capacity',
  'minPlayers',
  'startsAt',
  'durationMinutes',
  'timezone',
  'recurrence',
  'until',
  'joinMode',
  'modality',
  'locationArea',
  'joinDetails',
  'postalCode',
  'locationNeighbourhood',
  'locationCity',
  'locationState',
] as const;
const PRIVATE_FIELDS = [
  'welcomeMessage',
  'joinDetails',
  'postalCode',
  'locationNeighbourhood',
  'locationCity',
  'locationState',
] as const;

type Audited = (typeof AUDITED)[number] | 'system' | 'platforms' | 'tags' | 'image';

/** A pick as a person reads it: the slug, or the name of a term suggested on the spot. */
const picked = (picks: readonly string[]) =>
  picks
    .map((pick) =>
      pick.startsWith(NEW_CATALOG_PREFIX) ? pick.slice(NEW_CATALOG_PREFIX.length) : pick,
    )
    .sort();

/** What an edit changed in a table, for the event: see `diffFields`. */
function tableChanges(before: Record<Audited, Fact>, after: Record<Audited, Fact>) {
  return diffFields(before, after, { hidden: [...PRIVATE_FIELDS, 'image'] });
}

const sameValue = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date
    ? a.getTime() === b.getTime()
    : (a ?? null) === (b ?? null);

/**
 * Saves the form. The slug never changes, so shared links and calendar invites keep working, and
 * the calendar sequence goes up so invites replace the old event.
 */
export async function updateTable(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: TableInput,
  { imagePath }: { imagePath?: string } = {},
): Promise<{ eventId: string | null }> {
  const table = await findForWrite(db, slug);
  authorize(actor, 'table:edit', { gmId: table.gmId, tableStatus: table.status });

  const columns = columnsOf(input);
  // Invites and notifications go out only for a change players would see.
  const changed = PLAYER_FACING.some((field) => !sameValue(table[field], columns[field]));
  const [current] = await db
    .select({ slug: systems.slug })
    .from(systems)
    .where(eq(systems.id, table.systemId));
  const linked = (await catalogOf(db, [table.id], { withPending: true })).get(table.id)!;
  // Fewer seats than players would leave someone at the table without one: remove players first.
  if (input.capacity < (await seatsTakenAt(db, table.id))) {
    throw new Invalid('capacity', 'below_taken');
  }
  // A new image replaces the current one; without one, the GM may take the current one off.
  const image = imagePath ? { imagePath } : input.removeImage ? { imagePath: null } : {};
  const eventId = await db.transaction(async (tx) => {
    // The row is locked first, so the status read here is the one this save and a publish at the
    // same moment both see: a draft cannot go public between the check below and the update.
    const [locked] = await tx
      .select({ status: gameTables.status, systemId: gameTables.systemId })
      .from(gameTables)
      .where(eq(gameTables.id, table.id))
      .for('update');
    // A suggestion is the table's GM's, also when an admin is the one editing.
    const system = await systemFor(
      tx as unknown as AnyDb,
      input.systemSlug,
      table.gmId,
      locked.systemId,
    );
    // A public table cannot move to a system nobody approved: it would have to hide again.
    if (system.waiting && system.id !== locked.systemId && locked.status !== 'draft') {
      throw new Invalid('systemSlug', 'suggestion_needs_draft');
    }
    await tx
      .update(gameTables)
      // No new image leaves the current one as it is.
      .set({
        ...columns,
        systemId: system.id,
        ...image,
        ...(changed ? { icalSequence: table.icalSequence + 1 } : {}),
      })
      .where(eq(gameTables.id, table.id));
    await setTableCatalog(tx as unknown as AnyDb, table.id, catalogPicks(input, actor!.id));

    const changes = tableChanges(
      {
        ...Object.fromEntries(AUDITED.map((field) => [field, table[field]])),
        system: current.slug,
        platforms: picked(linked.platforms.map((item) => item.slug)),
        tags: picked(linked.tags.map((item) => item.slug)),
        // The picture itself is not logged, only that it was replaced or taken off.
        image: table.imagePath,
      } as unknown as Record<Audited, Fact>,
      {
        ...Object.fromEntries(AUDITED.map((field) => [field, columns[field]])),
        system: input.systemSlug,
        platforms: picked(input.platforms),
        tags: picked(input.tags),
        image: 'imagePath' in image ? image.imagePath : table.imagePath,
      } as unknown as Record<Audited, Fact>,
    );
    if (!changed && !hasChanges(changes)) return null;

    // Players hear about what they see; anything else is written for the history alone.
    return recordEvent(tx as unknown as AnyDb, {
      type: changed ? 'TableUpdated' : 'TableEdited',
      actorId: actor!.id,
      payload: {
        tableId: table.id,
        slug: table.slug,
        title: input.title,
        changes,
        ...(table.status === 'draft' ? { draft: true as const } : {}),
      },
    });
  });

  return { eventId };
}

/**
 * Makes a draft public: it is listed, people can join, and the same things follow as for a table
 * opened directly (the Instagram post, the GM's calendar invite). Counts against the limit on
 * opening tables. The update takes only a `draft` row, so two requests cannot both publish.
 */
export async function publishTable(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  now: Date = new Date(),
): Promise<{ eventId: string }> {
  const table = await findForWrite(db, slug);
  authorize(actor, 'table:edit', { gmId: table.gmId, tableStatus: table.status });
  if (table.status !== 'draft') throw new Invalid('slug', 'not_a_draft');
  if (table.startsAt < now) throw new Invalid('startsAtLocal', 'in_the_past');

  const eventId = await db.transaction(async (tx) => {
    // Locked and read again inside the transaction: an edit or an admin's decision at the same
    // moment cannot slip a system nobody approved under a table that is going public.
    const [locked] = await tx
      .select({ systemId: gameTables.systemId })
      .from(gameTables)
      .where(eq(gameTables.id, table.id))
      .for('update');
    const [system] = await tx
      .select({ status: systems.status })
      .from(systems)
      .where(eq(systems.id, locked.systemId))
      .for('share');
    // Its system is still a suggestion (or was turned down): the table waits, or takes another.
    if (system.status === 'pending') throw new Invalid('systemSlug', 'system_pending');
    if (system.status === 'rejected') throw new Invalid('systemSlug', 'system_rejected');
    await enforceRateLimit(tx as unknown as AnyDb, actor!.id, TABLE_CREATION_LIMIT, now);
    const published = await tx
      .update(gameTables)
      .set({ status: 'active' })
      .where(and(eq(gameTables.id, table.id), eq(gameTables.status, 'draft')))
      .returning({ id: gameTables.id });
    if (!published.length) throw new Invalid('slug', 'not_a_draft');

    return recordEvent(
      tx as unknown as AnyDb,
      {
        type: 'TableCreated',
        actorId: actor!.id,
        payload: { tableId: table.id, slug: table.slug, title: table.title, fromDraft: true },
      },
      { now },
    );
  });

  return { eventId };
}

/** Takes a table off the public pages. */
export async function disableTable(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
): Promise<{ eventId: string }> {
  const table = await findForWrite(db, slug);
  authorize(actor, 'table:disable', { gmId: table.gmId, tableStatus: table.status });

  const eventId = await db.transaction(async (tx) => {
    await tx
      .update(gameTables)
      .set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
      .where(eq(gameTables.id, table.id));

    return recordEvent(tx as unknown as AnyDb, {
      type: 'TableDisabled',
      actorId: actor!.id,
      payload: {
        tableId: table.id,
        slug: table.slug,
        title: table.title,
        ...(table.status === 'draft' ? { draft: true as const } : {}),
      },
    });
  });

  return { eventId };
}
