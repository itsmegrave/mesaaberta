import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import {
  events,
  profiles,
  ratings,
  registrations,
  gameTables,
} from '@mesaaberta/core/server/db/schema';
import { authorize, can, type Actor } from '@mesaaberta/core/server/auth/policy';
import { NotFound } from '@mesaaberta/core/server/errors';
import { gmRatingOf } from '@mesaaberta/core/server/ratings/service';
import { participantRatings, playerRatingsAt } from '@mesaaberta/core/server/ratings/players';
import { findTableBySlug } from '@mesaaberta/core/server/tables/queries';
import { systemWaitingOf } from '../systems';
import { markedPresent } from './attendance';
import { tablesPlayed } from '../profile/public';

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

  const [[source], rows, [gm], rating, recent, given, [held]] = await Promise.all([
    db
      .select({ moderatedAt: gameTables.moderatedAt })
      .from(gameTables)
      .where(eq(gameTables.id, table.id)),
    db
      .select({
        playerId: registrations.playerId,
        status: registrations.status,
        // A confirmed row changes only when it is confirmed: its last update is when the seat was given.
        since: registrations.updatedAt,
        message: registrations.message,
        attended: registrations.attended,
        ratingOpenedAt: registrations.ratingOpenedAt,
        // Already rated the table: the GM cannot mark them absent any more.
        rated: sql<boolean>`${ratings.playerId} is not null`,
        ...person,
      })
      .from(registrations)
      .innerJoin(profiles, eq(registrations.playerId, profiles.id))
      .leftJoin(
        ratings,
        and(
          eq(ratings.tableId, registrations.tableId),
          eq(ratings.playerId, registrations.playerId),
        ),
      )
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
    playerRatingsAt(db, table.id),
    // The sessions the GM confirmed so far, each one a `TableSessionHeld`.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(eq(events.type, 'TableSessionHeld'), sql`${events.payload}->>'tableId' = ${table.id}`),
      ),
  ]);
  const requests = rows.filter((row) => row.status === 'pending');
  // What the GM weighs a request by: the asker's public score as a participant.
  const confirmed = rows.filter((row) => row.status === 'confirmed');
  const [scores, played] = await Promise.all([
    participantRatings(
      db,
      requests.map((row) => row.playerId),
      now,
    ),
    // "Jogou N mesas" on the rating rows: the same total as the profile's "Mesas jogadas".
    tablesPlayed(
      db,
      confirmed.map((row) => row.playerId),
    ),
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
    canDuplicate: can(actor, 'table:duplicate', {
      gmId: table.gmId,
      moderatedAt: source.moderatedAt,
    }),
    // A draft whose system is a suggestion says so instead of offering to publish.
    systemWaiting: table.status === 'draft' ? await systemWaitingOf(db, table.system.slug) : null,
    gm: gm as Person,
    gmRating: rating,
    // Which session the current date is: "sessão 3 (de 4)". A one-shot has only the one.
    session: table.kind === 'one_shot' ? null : (held?.count ?? 0) + 1,
    requests: requests.map((row) => ({
      ...row,
      participantRating: scores.get(row.playerId)!,
    })),
    // `markedPresent`: the GM can rate them; `playerRating`: the score the GM gave them here, or null.
    players: confirmed.map((row) => ({
      ...row,
      tablesPlayed: played.get(row.playerId)!,
      markedPresent: markedPresent(row),
      playerRating: given.get(row.playerId) ?? null,
    })),
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
