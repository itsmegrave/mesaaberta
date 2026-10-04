import { and, desc, eq, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { events, gameTables, profiles } from '../db/schema';
import { RETENTION_DAYS } from '../events/dispatcher';
import type { Changes, EventType } from '../events/types';

/** How many entries a history shows: the newest, with a note when there are more. */
export const HISTORY_SHOWN = 50;

/**
 * One thing that happened to a table or a person, as an admin reads it: who did it (null for the
 * system: the sweeper asking the GM whether the session happened), what, when, and for an edit what
 * it changed. Ids only in the record; the names are looked up here.
 */
export type HistoryEntry = {
  id: string;
  type: EventType;
  at: Date;
  actor: { id: string; username: string | null } | null;
  /** The player or the account the event is about, when it is not the actor. */
  subject: string | null;
  /** The table the event names, for a person's history. */
  table: string | null;
  removed: boolean;
  changes: Changes | null;
};

/** `retentionDays`: events are deleted after it, so a history reaches back only that far. */
export type History = { entries: HistoryEntry[]; more: boolean; retentionDays: number };

/** Sign-ins carry an address: they are the connection log, kept for the law, not a history to browse. */
const NOT_SHOWN: EventType[] = ['UserSignedIn'];

async function history(db: AnyDb, where: SQL | undefined): Promise<History> {
  const actor = alias(profiles, 'actor');
  const tableOf = sql`(${events.payload}->>'tableId')::uuid`;
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      payload: events.payload,
      at: events.createdAt,
      actorId: events.actorId,
      actorName: actor.username,
      table: gameTables.title,
    })
    .from(events)
    .leftJoin(actor, eq(actor.id, events.actorId))
    .leftJoin(gameTables, eq(gameTables.id, tableOf))
    .where(and(where, notInArray(events.type, NOT_SHOWN)))
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(HISTORY_SHOWN + 1);

  const shown = rows.slice(0, HISTORY_SHOWN);
  // Name the people the payloads point at: the player who joined, the account that was suspended.
  const ids = [
    ...new Set(
      shown.flatMap((row) => {
        const payload = row.payload as Record<string, unknown>;
        return [payload.profileId, payload.playerId].filter(
          (value): value is string => typeof value === 'string',
        );
      }),
    ),
  ];
  const names = new Map(
    ids.length
      ? (
          await db
            .select({ id: profiles.id, username: profiles.username })
            .from(profiles)
            .where(inArray(profiles.id, ids))
        ).map((profile) => [profile.id, profile.username])
      : [],
  );

  return {
    more: rows.length > HISTORY_SHOWN,
    retentionDays: RETENTION_DAYS,
    entries: shown.map((row) => {
      const payload = row.payload as {
        profileId?: string;
        playerId?: string;
        reason?: string;
        title?: string;
        changes?: Changes;
      };
      const subjectId = payload.profileId ?? payload.playerId;
      return {
        id: row.id,
        type: row.type as EventType,
        at: row.at,
        actor: row.actorId ? { id: row.actorId, username: row.actorName } : null,
        // The one who did it is not repeated as the subject ("ana entrou" not "ana entrou ana").
        subject: subjectId && subjectId !== row.actorId ? (names.get(subjectId) ?? null) : null,
        table: row.table ?? payload.title ?? null,
        removed: payload.reason === 'removed',
        changes: payload.changes ?? null,
      };
    }),
  };
}

/** Everything that happened to a table: its edits, its session, who joined and left, what moderation did. */
export async function tableHistory(db: AnyDb, actor: Actor | null, tableId: string) {
  authorize(actor, 'moderation:manage');

  return history(db, sql`${events.payload}->>'tableId' = ${tableId}`);
}

/**
 * Everything a person did and everything done to them: their own actions (a profile saved, a table
 * created, a seat asked for), and what others did that names them (a ban, a removal from a table).
 */
export async function profileHistory(db: AnyDb, actor: Actor | null, profileId: string) {
  authorize(actor, 'moderation:manage');

  return history(
    db,
    or(
      eq(events.actorId, profileId),
      sql`${events.payload}->>'profileId' = ${profileId}`,
      sql`${events.payload}->>'playerId' = ${profileId}`,
    ),
  );
}
