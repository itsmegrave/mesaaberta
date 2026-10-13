import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import { events, profiles, registrations } from '@mesaaberta/core/server/db/schema';
import { authorize, can, type Actor } from '@mesaaberta/core/server/auth/policy';
import { NotFound } from '@mesaaberta/core/server/errors';
import { gmRatingOf } from '@mesaaberta/core/server/ratings/service';
import { findTableBySlug } from '@mesaaberta/core/server/tables/queries';
import { systemWaitingOf } from '../systems';

/** The events a GM sees in "Atividade recente": what people did at the table, newest first. */
export const ACTIVITY_TYPES = [
  'TableCreated',
  'TableDrafted',
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
  const table = await findTableBySlug(
    db,
    slug,
    now,
    actor && { id: actor.id, admin: can(actor, 'admin:access') },
  );
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
        message: registrations.message,
        ...person,
      })
      .from(registrations)
      .innerJoin(profiles, eq(registrations.playerId, profiles.id))
      .where(eq(registrations.tableId, table.id))
      .orderBy(asc(registrations.updatedAt), asc(profiles.username)),
    db.select(person).from(profiles).where(eq(profiles.id, table.gmId)),
    gmRatingOf(db, table.gmId),
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
    // A draft whose system is a suggestion says so instead of offering to publish.
    systemWaiting: table.status === 'draft' ? await systemWaitingOf(db, table.system.slug) : null,
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
