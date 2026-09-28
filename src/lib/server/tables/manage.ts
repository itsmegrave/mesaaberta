import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { publicName } from '../db/public-name';
import { events, profiles, registrations } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { NotFound } from '../errors';
import { gmRating } from '../ratings/service';
import { findTableBySlug } from './queries';

/** The events a GM sees in "Atividade recente": what people did at the table, newest first. */
export const ACTIVITY_TYPES = [
  'TableCreated',
  'TableUpdated',
  'JoinRequested',
  'JoinApproved',
  'JoinDeclined',
  'PlayerJoined',
  'PlayerLeft',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const ACTIVITY_SHOWN = 8;

type Person = { username: string; avatarUrl: string | null; avatarPath: string | null };

/**
 * Everything the GM's manage page shows, for the GM of the table (or an admin): the table, the
 * requests waiting, the players with the day they got their seat, the GM's rating and the latest
 * activity. Throws NotFound for a table that is not there (or is disabled), Forbidden for anyone else.
 */
export async function loadManage(db: AnyDb, actor: Actor | null, slug: string, now: Date) {
  const table = await findTableBySlug(db, slug, now);
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  authorize(actor, 'registration:manage', table);

  const person = {
    username: publicName(profiles.username),
    avatarUrl: profiles.avatarUrl,
    avatarPath: profiles.avatarPath,
  };

  const [rows, [gm], rating, recent] = await Promise.all([
    db
      .select({
        playerId: registrations.playerId,
        status: registrations.status,
        // A confirmed row changes only when it is confirmed: its last update is when the seat was given.
        since: registrations.updatedAt,
        ...person,
      })
      .from(registrations)
      .innerJoin(profiles, eq(registrations.playerId, profiles.id))
      .where(eq(registrations.tableId, table.id))
      .orderBy(asc(registrations.updatedAt), asc(profiles.username)),
    db.select(person).from(profiles).where(eq(profiles.id, table.gmId)),
    gmRating(db, table.gmId),
    db
      .select({ type: events.type, payload: events.payload, at: events.createdAt })
      .from(events)
      .where(
        and(
          sql`${events.payload}->>'tableId' = ${table.id}`,
          inArray(events.type, [...ACTIVITY_TYPES]),
        ),
      )
      .orderBy(desc(events.createdAt))
      .limit(ACTIVITY_SHOWN),
  ]);

  // The players the activity names, by id: one query, whoever they are.
  const playerIds = [
    ...new Set(
      recent.flatMap((event) => {
        const id = (event.payload as { playerId?: unknown }).playerId;
        return typeof id === 'string' ? [id] : [];
      }),
    ),
  ];
  const names = new Map(
    playerIds.length === 0
      ? []
      : (
          await db
            .select({ id: profiles.id, username: publicName(profiles.username) })
            .from(profiles)
            .where(inArray(profiles.id, playerIds))
        ).map((row) => [row.id, row.username]),
  );

  return {
    table,
    gm: gm as Person,
    gmRating: rating,
    requests: rows.filter((row) => row.status === 'pending'),
    players: rows.filter((row) => row.status === 'confirmed'),
    activity: recent.map((event) => {
      const payload = event.payload as { playerId?: string; reason?: 'left' | 'removed' };
      return {
        type: event.type as ActivityType,
        at: event.at,
        // Null for the events about the table itself.
        player: payload.playerId ? (names.get(payload.playerId) ?? null) : null,
        removed: payload.reason === 'removed',
      };
    }),
  };
}
