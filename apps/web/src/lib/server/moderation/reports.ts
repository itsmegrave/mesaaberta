import { and, eq } from 'drizzle-orm';
import type { ReportInput } from '$lib/moderation/reports';
import { authorize, can, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations, reports } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { enforceRateLimit, REPORT_LIMIT } from '../rate-limit';

async function seated(db: AnyDb, tableId: string, playerId: string) {
  const [row] = await db
    .select({ status: registrations.status })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));
  return row?.status === 'confirmed';
}

/**
 * A member reports the table at `slug`, or a player they share it with (`input.playerId`). Refused
 * for oneself, for a player the two do not share, and while the same report is still waiting on an
 * admin. Counts against REPORT_LIMIT. Returns the `ReportFiled` event to dispatch.
 */
export async function fileReport(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: ReportInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventId: string }> {
  const [table] = await db
    .select({ id: gameTables.id, gmId: gameTables.gmId, status: gameTables.status })
    .from(gameTables)
    .where(eq(gameTables.slug, slug));
  // A disabled table is off the public pages: there is nothing left to report.
  if (!table || table.status === 'disabled') throw new NotFound(`no table with slug "${slug}"`);

  const playerId = input.targetType === 'player' ? input.playerId : '';
  if (input.targetType === 'player' && !playerId) throw new Invalid('playerId', 'required');
  const reporterSeated = actor ? await seated(db, table.id, actor.id) : false;
  authorize(actor, 'report:file', {
    gmId: table.gmId,
    reporterSeated,
    target:
      input.targetType === 'table'
        ? { type: 'table' }
        : { type: 'player', playerId, playerSeated: await seated(db, table.id, playerId) },
  });

  const targetId = input.targetType === 'table' ? table.id : playerId;
  const eventId = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actor!.id, REPORT_LIMIT, now);
    const [report] = await t
      .insert(reports)
      .values({
        reporterId: actor!.id,
        targetType: input.targetType,
        targetId,
        tableId: table.id,
        reason: input.reason,
        details: input.details,
        createdAt: now,
      })
      // The partial unique index: this reporter already has one waiting for the same target.
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!report) throw new Invalid('', 'already_reported');

    return recordEvent(
      t,
      {
        type: 'ReportFiled',
        actorId: actor!.id,
        payload: {
          reportId: report.id,
          targetType: input.targetType,
          targetId,
          tableId: table.id,
          reason: input.reason,
        },
      },
      { now },
    );
  });

  return { eventId };
}

/**
 * What this visitor may report at a table: the table itself, and the people they share it with
 * (the GM and the confirmed players, never themselves). Names go only to someone who shares the
 * table, who already sees them in its chat.
 */
export async function reportTargetsOf(
  db: AnyDb,
  actor: Actor | null,
  table: { id: string; gmId: string },
) {
  if (!actor) return { table: false, people: [] };
  const reporterSeated = await seated(db, table.id, actor.id);
  const facts = { gmId: table.gmId, reporterSeated };
  const canTable = can(actor, 'report:file', { ...facts, target: { type: 'table' } });
  if (actor.id !== table.gmId && !reporterSeated) return { table: canTable, people: [] };

  const seatedPlayers = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(registrations)
    .innerJoin(profiles, eq(profiles.id, registrations.playerId))
    .where(and(eq(registrations.tableId, table.id), eq(registrations.status, 'confirmed')));
  const [gm] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, table.gmId));
  const seatedIds = new Set(seatedPlayers.map((player) => player.id));
  const people = [...(gm ? [gm] : []), ...seatedPlayers].filter(
    (person): person is { id: string; username: string } =>
      person.username !== null &&
      can(actor, 'report:file', {
        ...facts,
        target: { type: 'player', playerId: person.id, playerSeated: seatedIds.has(person.id) },
      }),
  );
  return { table: canTable, people };
}
