import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, ratings, registrations, systems } from '../db/schema';
import { publicName } from '../db/public-name';
import { rateBlocker } from '../auth/policy';
import { firstSessionEnded } from '../ratings/service';
import { hasStarted } from '../tables/schedule';
import { seatsLeft } from '../tables/queries';

// The "My tables" page: what I play in, and what I run. Sessions coming up come first, soonest
// first; the ones that have started go last, the most recent first.
const byStart = <T extends { startsAt: Date }>(items: T[], now: Date) =>
  items.sort((a, b) => {
    const aStarted = hasStarted(a.startsAt, now);
    const bStarted = hasStarted(b.startsAt, now);
    if (aStarted !== bStarted) return aStarted ? 1 : -1;
    const order = a.startsAt.getTime() - b.startsAt.getTime();
    return aStarted ? -order : order;
  });

/** The tables where this person has a seat or a pending request. */
export async function listPlaying(db: AnyDb, playerId: string, now: Date) {
  const gm = profiles;
  const rows = await db
    .select({
      slug: gameTables.slug,
      title: gameTables.title,
      kind: gameTables.kind,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
      timezone: gameTables.timezone,
      tableStatus: gameTables.status,
      gmId: gameTables.gmId,
      gmName: publicName(gm.username),
      systemName: systems.name,
      status: registrations.status,
      gmScore: ratings.gmScore,
    })
    .from(registrations)
    .innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
    .innerJoin(systems, eq(gameTables.systemId, systems.id))
    .innerJoin(gm, eq(gameTables.gmId, gm.id))
    .leftJoin(
      ratings,
      and(eq(ratings.tableId, registrations.tableId), eq(ratings.playerId, registrations.playerId)),
    )
    .where(eq(registrations.playerId, playerId));

  const actor = { id: playerId, role: 'member', status: 'active' } as const;

  return byStart(
    rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      systemName: row.systemName,
      gmName: row.gmName,
      status: row.status,
      tableStatus: row.tableStatus,
      timezone: row.timezone,
      startsAt: row.startsAt,
      // The prompt to rate: a confirmed seat, and the GM confirmed the session happened.
      canRate:
        rateBlocker(actor, {
          gmId: row.gmId,
          registration: row.status,
          tableStatus: row.tableStatus,
          firstSessionEnded: firstSessionEnded(row, now),
        }) === null,
      rating: row.gmScore === null ? null : { gmScore: row.gmScore },
    })),
    now,
  );
}

/** The tables this person is the GM of, with who has a seat and who is waiting. */
export async function listRunning(db: AnyDb, gmId: string, now: Date) {
  const tables = await db
    .select()
    .from(gameTables)
    .where(eq(gameTables.gmId, gmId))
    .orderBy(asc(gameTables.startsAt));
  if (tables.length === 0) return [];

  const people = await db
    .select({
      tableId: registrations.tableId,
      playerId: registrations.playerId,
      username: publicName(profiles.username),
      status: registrations.status,
    })
    .from(registrations)
    .innerJoin(profiles, eq(registrations.playerId, profiles.id))
    .where(
      inArray(
        registrations.tableId,
        tables.map((table) => table.id),
      ),
    )
    .orderBy(asc(registrations.createdAt), asc(profiles.username));

  return byStart(
    tables.map((table) => {
      const mine = people.filter((person) => person.tableId === table.id);
      const players = mine
        .filter((person) => person.status === 'confirmed')
        .map(({ playerId, username }) => ({ playerId, username }));
      const requests = mine
        .filter((person) => person.status === 'pending')
        .map(({ playerId, username }) => ({ playerId, username }));

      return {
        slug: table.slug,
        title: table.title,
        tableStatus: table.status,
        joinMode: table.joinMode,
        capacity: table.capacity,
        seatsLeft: seatsLeft(table.capacity, players.length),
        timezone: table.timezone,
        startsAt: table.startsAt,
        players,
        requests,
      };
    }),
    now,
  );
}
