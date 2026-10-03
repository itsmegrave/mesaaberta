import { and, count, eq, like } from 'drizzle-orm';
import { addTableMember } from '../messages/service';
import type { AnyDb } from '../db/client';
import { gameTables, registrations, systems } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { catalogOf, setTableCatalog } from '../catalog';
import { TABLE_CREATION_LIMIT, enforceRateLimit } from '../rate-limit';
import { instantToLocal, localToInstant } from './schedule';
import { slugify, tableSlug } from '$lib/slug';
import { minutesToHours } from '$lib/tables/format';
import type { TableInput } from '$lib/tables/schema';
import { formatCep } from '$lib/location/cep';

const MAX_SLUG_ATTEMPTS = 5;

/** A Postgres unique violation on the slug index (drizzle wraps the driver's error as `cause`). */
function isSlugConflict(error: unknown): boolean {
  const { code, constraint_name, constraint, message } = ((error as { cause?: unknown }).cause ??
    error) as Record<string, string | undefined>;

  return code === '23505' && `${constraint_name ?? constraint ?? message}`.includes('slug');
}

async function systemIdOf(db: AnyDb, slug: string) {
  const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.slug, slug));
  if (!system) throw new Invalid('systemSlug', 'invalid');

  return system.id;
}

/** The columns a form controls. Never the slug, the GM, the status or the calendar sequence. */
const catalogPicks = (input: TableInput, gmId: string) => ({
  gmId,
  platformSlugs: input.platforms,
  tagSlugs: input.tags,
});

async function columnsOf(db: AnyDb, input: TableInput) {
  return {
    systemId: await systemIdOf(db, input.systemSlug),
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
 */
export async function createTable(
  db: AnyDb,
  actor: Actor | null,
  input: TableInput,
  { now = new Date(), imagePath = null }: { now?: Date; imagePath?: string | null } = {},
): Promise<{ slug: string; eventId: string }> {
  authorize(actor, 'table:create');

  const columns = { ...(await columnsOf(db, input)), imagePath };
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
      const eventId = await db.transaction(async (tx) => {
        await enforceRateLimit(tx as unknown as AnyDb, actor!.id, TABLE_CREATION_LIMIT, now);

        const [created] = await tx
          .insert(gameTables)
          .values({ ...columns, slug, gmId: actor!.id })
          .returning({ id: gameTables.id });
        await setTableCatalog(tx as unknown as AnyDb, created.id, catalogPicks(input, actor!.id));
        await addTableMember(tx as unknown as AnyDb, created.id, actor!.id);

        return recordEvent(
          tx as unknown as AnyDb,
          {
            type: 'TableCreated',
            actorId: actor!.id,
            payload: { tableId: created.id, slug, title: input.title },
          },
          { now },
        );
      });
      return { slug, eventId };
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

  const columns = await columnsOf(db, input);
  // Invites and notifications go out only for a change players would see.
  const changed = PLAYER_FACING.some((field) => !sameValue(table[field], columns[field]));
  // Fewer seats than players would leave someone at the table without one: remove players first.
  if (input.capacity < (await seatsTakenAt(db, table.id))) {
    throw new Invalid('capacity', 'below_taken');
  }
  // A new image replaces the current one; without one, the GM may take the current one off.
  const image = imagePath ? { imagePath } : input.removeImage ? { imagePath: null } : {};
  const eventId = await db.transaction(async (tx) => {
    await tx
      .update(gameTables)
      // No new image leaves the current one as it is.
      .set({
        ...columns,
        ...image,
        ...(changed ? { icalSequence: table.icalSequence + 1 } : {}),
      })
      .where(eq(gameTables.id, table.id));
    await setTableCatalog(tx as unknown as AnyDb, table.id, catalogPicks(input, actor!.id));
    if (!changed) return null;

    return recordEvent(tx as unknown as AnyDb, {
      type: 'TableUpdated',
      actorId: actor!.id,
      payload: { tableId: table.id, slug: table.slug, title: input.title },
    });
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
      payload: { tableId: table.id, slug: table.slug, title: table.title },
    });
  });

  return { eventId };
}
