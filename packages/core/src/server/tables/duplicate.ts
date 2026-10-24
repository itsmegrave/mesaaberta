import { and, eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, systems } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid, NotFound } from '../errors';
import { catalogOf } from '../catalog';
import { isLocalDateTime, tableInputSchema, type TableInput } from '../../tables/schema';
import { instantToLocal, localToInstant } from './schedule';
import { guardNewCopy, lockTableSchedule } from './schedule-guard';
import { createTable } from './write';

async function sourceFor(db: AnyDb, actor: Actor | null, slug: string, lock = false) {
  const query = db.select().from(gameTables).where(eq(gameTables.slug, slug));
  const [source] = await (lock ? query.for('update') : query);
  if (!source) throw new NotFound('table');
  authorize(actor, 'table:duplicate', { gmId: source.gmId, moderatedAt: source.moderatedAt });
  return source;
}

/** Only content/configuration is returned. Opening the form never writes a table or an event. */
export async function loadTableForDuplication(
  db: AnyDb,
  actor: Actor | null,
  sourceSlug: string,
): Promise<{
  sourceId: string;
  sourceSlug: string;
  input: Omit<TableInput, 'startsAtLocal'> & { startsAtLocal: '' };
  imagePath: string | null;
}> {
  const source = await sourceFor(db, actor, sourceSlug);
  const [system] = await db
    .select({ slug: systems.slug })
    .from(systems)
    .where(eq(systems.id, source.systemId));
  const catalog = (await catalogOf(db, [source.id], { withPending: true })).get(source.id)!;
  return {
    sourceId: source.id,
    sourceSlug: source.slug,
    imagePath: source.imagePath,
    input: {
      systemSlug: system.slug,
      title: source.title,
      description: source.description,
      extraInfo: source.extraInfo,
      welcomeMessage: source.welcomeMessage,
      kind: source.kind,
      capacity: source.capacity,
      minPlayers: source.minPlayers,
      startsAtLocal: '',
      timezone: source.timezone,
      durationMinutes: source.durationMinutes,
      recurrence: source.recurrence,
      untilLocalDate: source.until
        ? instantToLocal(source.until, source.timezone).slice(0, 10)
        : null,
      joinMode: source.joinMode,
      modality: source.modality,
      locationArea: source.locationArea,
      joinDetails: source.joinDetails,
      postalCode: source.postalCode,
      locationNeighbourhood: source.locationNeighbourhood,
      locationCity: source.locationCity,
      locationState: source.locationState,
      platforms: catalog.platforms.map((entry) => entry.slug),
      tags: catalog.tags.map((entry) => entry.slug),
      removeImage: false,
    },
  };
}

type DuplicateOptions = {
  now?: Date;
  draft?: boolean;
  image?:
    { kind: 'inherit' } | { kind: 'remove' } | { kind: 'replace'; validatedImagePath: string };
  requestKey?: string;
};

/** Re-read the authorized source under the schedule lock; content, event and chat commit together. */
export async function duplicateTable(
  db: AnyDb,
  actor: Actor | null,
  sourceSlug: string,
  input: TableInput,
  {
    now = new Date(),
    draft = false,
    image = { kind: 'inherit' },
    requestKey,
  }: DuplicateOptions = {},
): Promise<{ slug: string; eventId: string; draft: boolean }> {
  authorize(actor, 'table:create');
  if (!isLocalDateTime(input.startsAtLocal)) throw new Invalid('startsAtLocal', 'invalid');
  const parsed = tableInputSchema.safeParse(input);
  if (!parsed.success) throw new Invalid(String(parsed.error.issues[0]?.path[0] ?? ''), 'invalid');
  input = parsed.data;
  if (input.untilLocalDate && input.untilLocalDate < input.startsAtLocal.slice(0, 10))
    throw new Invalid('until', 'before_start');
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    await lockTableSchedule(tx, actor!.id);
    // A replay answers with the copy that exists, even when its source was deleted or moderated since.
    if (requestKey) {
      const [existing] = await tx
        .select()
        .from(gameTables)
        .where(
          and(eq(gameTables.gmId, actor!.id), eq(gameTables.duplicationRequestKey, requestKey)),
        );
      if (existing) {
        // The link is cleared with a deleted source; while it is there, the key is for that source only.
        if (existing.duplicatedFromTableId) {
          const [named] = await tx
            .select({ id: gameTables.id })
            .from(gameTables)
            .where(eq(gameTables.slug, sourceSlug));
          if (named?.id !== existing.duplicatedFromTableId)
            throw new Invalid('requestKey', 'invalid');
        }
        return {
          slug: existing.slug,
          eventId: existing.duplicationEventId!,
          draft: existing.status === 'draft',
        };
      }
    }
    const source = await sourceFor(tx, actor, sourceSlug, true);
    await guardNewCopy(tx, source.id, {
      startsAt: localToInstant(input.startsAtLocal, input.timezone),
      durationMinutes: input.durationMinutes,
    });
    return createTable(tx, actor, input, {
      now,
      draft,
      imagePath:
        image.kind === 'replace'
          ? image.validatedImagePath
          : image.kind === 'remove' || input.removeImage
            ? null
            : source.imagePath,
      duplicatedFromTableId: source.id,
      duplicationRequestKey: requestKey,
    });
  });
}
