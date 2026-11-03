// Relative imports only: the api Worker bundles this file next to the delivery graph.
import { and, asc, count, eq, gt, inArray } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  gameTables,
  profiles,
  registrations,
  tableSessionSignups,
  tableSessions,
} from '../db/schema';
import { publicName } from '../db/public-name';
import { authorize, type Actor } from '../auth/policy';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';

// Campanha aberta (`use_session_signup`, checked by the web Worker): each session of the table has
// its own places (`session_size`). A player on the roster signs up for a session and plays it while
// it has room, or waits for it; when someone who plays leaves, the first who waits takes the place
// in the same transaction, under the session's lock, so a place never goes to two people. Quem
// mestra puts anyone from the roster in a session (even a full one) or takes them out.

type Table = typeof gameTables.$inferSelect;
type Session = typeof tableSessions.$inferSelect;
type Status = 'going' | 'waiting';

/** How many play one session of the table: its session size, or every seat when it has none. */
export const sessionSize = (table: Pick<Table, 'sessionSize' | 'capacity'>) =>
  table.sessionSize ?? table.capacity;

async function tableOf(db: AnyDb, slug: string): Promise<Table> {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  return table;
}

/** The table's session `sessionId`, locked, while it is scheduled and still ahead. */
async function openSession(tx: AnyDb, table: Table, sessionId: string, now: Date) {
  const [session] = await tx
    .select()
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.id, sessionId),
        eq(tableSessions.tableId, table.id),
        eq(tableSessions.status, 'scheduled'),
      ),
    )
    .for('update');
  if (!session) throw new NotFound('session');
  if (session.startsAt <= now) throw new Invalid('sessionId', 'already_started');
  return session;
}

async function confirmed(db: AnyDb, tableId: string, playerId: string): Promise<boolean> {
  const [seat] = await db
    .select({ status: registrations.status })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));
  return seat?.status === 'confirmed';
}

async function signupOf(tx: AnyDb, sessionId: string, playerId: string) {
  const [row] = await tx
    .select({ status: tableSessionSignups.status })
    .from(tableSessionSignups)
    .where(
      and(eq(tableSessionSignups.sessionId, sessionId), eq(tableSessionSignups.playerId, playerId)),
    );
  return row?.status ?? null;
}

async function goingCount(tx: AnyDb, sessionId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(tableSessionSignups)
    .where(
      and(eq(tableSessionSignups.sessionId, sessionId), eq(tableSessionSignups.status, 'going')),
    );
  return row?.n ?? 0;
}

const fact = (table: Table, session: Session) => ({
  tableId: table.id,
  slug: table.slug,
  title: table.title,
  sessionId: session.id,
  startsAt: session.startsAt.toISOString(),
});

const signedUp = (
  tx: AnyDb,
  actorId: string | null,
  table: Table,
  session: Session,
  playerId: string,
  waiting: boolean,
  by: 'player' | 'gm' | 'waitlist',
) =>
  recordEvent(tx, {
    type: 'SessionSignedUp',
    actorId,
    payload: { ...fact(table, session), playerId, waiting, by },
  });

/** While the session has room, the first who wait take the places. Answers their events. */
async function promote(
  tx: AnyDb,
  actorId: string | null,
  table: Table,
  session: Session,
): Promise<string[]> {
  const room = sessionSize(table) - (await goingCount(tx, session.id));
  if (room <= 0) return [];
  const next = await tx
    .select({ playerId: tableSessionSignups.playerId })
    .from(tableSessionSignups)
    .where(
      and(eq(tableSessionSignups.sessionId, session.id), eq(tableSessionSignups.status, 'waiting')),
    )
    .orderBy(asc(tableSessionSignups.createdAt), asc(tableSessionSignups.playerId))
    .limit(room);
  const eventIds: string[] = [];
  for (const { playerId } of next) {
    await tx
      .update(tableSessionSignups)
      .set({ status: 'going' })
      .where(
        and(
          eq(tableSessionSignups.sessionId, session.id),
          eq(tableSessionSignups.playerId, playerId),
        ),
      );
    eventIds.push(await signedUp(tx, actorId, table, session, playerId, false, 'waitlist'));
  }
  return eventIds;
}

/** Takes `playerId` off the session; the first who wait move up when they played it. */
async function takeOff(
  tx: AnyDb,
  actorId: string | null,
  table: Table,
  session: Session,
  playerId: string,
  status: Status,
  reason: 'left' | 'removed' | null,
): Promise<string[]> {
  await tx
    .delete(tableSessionSignups)
    .where(
      and(
        eq(tableSessionSignups.sessionId, session.id),
        eq(tableSessionSignups.playerId, playerId),
      ),
    );
  const eventIds = reason
    ? [
        await recordEvent(tx, {
          type: 'SessionSignupLeft',
          actorId,
          payload: { ...fact(table, session), playerId, waiting: status === 'waiting', reason },
        }),
      ]
    : [];
  if (status === 'going') eventIds.push(...(await promote(tx, actorId, table, session)));
  return eventIds;
}

function playerTable(actor: Actor | null, table: Table, isConfirmed: boolean) {
  authorize(actor, 'session:signup', {
    tableStatus: table.status,
    kind: table.kind,
    confirmed: isConfirmed,
  });
}

/**
 * "Quero jogar esta": the player plays the session while it has room, or waits for it. Signing up
 * twice changes nothing.
 */
export async function signUpForSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  { sessionId }: { sessionId: string },
  now = new Date(),
): Promise<{ eventIds: string[] }> {
  const table = await tableOf(db, slug);
  playerTable(actor, table, !!actor && (await confirmed(db, table.id, actor.id)));
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    const session = await openSession(tx, table, sessionId, now);
    if (await signupOf(tx, session.id, actor!.id)) return { eventIds: [] };
    const waiting = (await goingCount(tx, session.id)) >= sessionSize(table);
    await tx.insert(tableSessionSignups).values({
      sessionId: session.id,
      tableId: table.id,
      playerId: actor!.id,
      status: waiting ? 'waiting' : 'going',
      createdAt: now,
    });
    return {
      eventIds: [await signedUp(tx, actor!.id, table, session, actor!.id, waiting, 'player')],
    };
  });
}

/** "Sair desta sessão" or "Sair da espera". Nothing to do when they were not in it. */
export async function leaveSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  { sessionId }: { sessionId: string },
  now = new Date(),
): Promise<{ eventIds: string[] }> {
  const table = await tableOf(db, slug);
  playerTable(actor, table, !!actor && (await confirmed(db, table.id, actor.id)));
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    const session = await openSession(tx, table, sessionId, now);
    const status = await signupOf(tx, session.id, actor!.id);
    if (!status) return { eventIds: [] };
    return { eventIds: await takeOff(tx, actor!.id, table, session, actor!.id, status, 'left') };
  });
}

function gmTable(actor: Actor | null, table: Table) {
  authorize(actor, 'table:sessions', {
    gmId: table.gmId,
    tableStatus: table.status,
    kind: table.kind,
  });
  if (table.kind !== 'open') throw new NotFound('session sign-up');
}

/**
 * Quem mestra puts someone from the roster in the session ("Pôr na sessão"), a full one too, or
 * moves them up from its waiting list.
 */
export async function addToSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  { sessionId, playerId }: { sessionId: string; playerId: string },
  now = new Date(),
): Promise<{ eventId: string | null }> {
  const table = await tableOf(db, slug);
  gmTable(actor, table);
  if (!(await confirmed(db, table.id, playerId))) throw new NotFound('that player has no seat');
  const eventId = await db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    const session = await openSession(tx, table, sessionId, now);
    const status = await signupOf(tx, session.id, playerId);
    if (status === 'going') return null;
    if (status === 'waiting') {
      await tx
        .update(tableSessionSignups)
        .set({ status: 'going' })
        .where(
          and(
            eq(tableSessionSignups.sessionId, session.id),
            eq(tableSessionSignups.playerId, playerId),
          ),
        );
    } else {
      await tx.insert(tableSessionSignups).values({
        sessionId: session.id,
        tableId: table.id,
        playerId,
        status: 'going',
        createdAt: now,
      });
    }
    return signedUp(tx, actor!.id, table, session, playerId, false, 'gm');
  });
  return { eventId };
}

/** Quem mestra takes someone out of the session ("Tirar"); the first who waits takes the place. */
export async function removeFromSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  { sessionId, playerId }: { sessionId: string; playerId: string },
  now = new Date(),
): Promise<{ eventId: string | null; eventIds: string[] }> {
  const table = await tableOf(db, slug);
  gmTable(actor, table);
  const eventIds = await db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    const session = await openSession(tx, table, sessionId, now);
    const status = await signupOf(tx, session.id, playerId);
    if (!status) throw new NotFound('not in that session');
    return takeOff(tx, actor!.id, table, session, playerId, status, 'removed');
  });
  return { eventId: eventIds[0] ?? null, eventIds };
}

/**
 * A player is leaving the table (or is taken off it): inside that transaction, before their seat
 * goes, they leave every session ahead, and the first who wait take the places they had. Their
 * leaving the table is its own event; this answers the moves up.
 */
export async function releaseSessionSeats(
  tx: AnyDb,
  actorId: string | null,
  tableId: string,
  playerId: string,
  now = new Date(),
): Promise<string[]> {
  const rows = await tx
    .select({ session: tableSessions, status: tableSessionSignups.status })
    .from(tableSessionSignups)
    .innerJoin(tableSessions, eq(tableSessions.id, tableSessionSignups.sessionId))
    .where(
      and(
        eq(tableSessionSignups.tableId, tableId),
        eq(tableSessionSignups.playerId, playerId),
        eq(tableSessions.status, 'scheduled'),
        gt(tableSessions.startsAt, now),
      ),
    );
  if (rows.length === 0) return [];
  const [table] = await tx.select().from(gameTables).where(eq(gameTables.id, tableId));
  const eventIds: string[] = [];
  for (const { session, status } of rows) {
    eventIds.push(...(await takeOff(tx, actorId, table, session, playerId, status, null)));
  }
  return eventIds;
}

/** One session's places, as a viewer of the table may see them. */
export type SessionSeats = {
  /** How many play it. */
  size: number;
  going: number;
  waiting: number;
  /** The viewer's own place: playing, waiting (and where in line), or none. */
  mine: Status | null;
  position: number | null;
  /** For quem mestra: who plays and who waits, in order. */
  people: { playerId: string; username: string; status: Status; position: number | null }[] | null;
};

/**
 * The places of each session of a campanha aberta, by session id: counts for everyone, the
 * viewer's own place, and for quem mestra the names.
 */
export async function sessionSeatsOf(
  db: AnyDb,
  table: Pick<Table, 'kind' | 'sessionSize' | 'capacity'>,
  sessionIds: string[],
  viewer: { gm: boolean; playerId: string | null },
): Promise<Map<string, SessionSeats>> {
  const seats = new Map<string, SessionSeats>();
  if (table.kind !== 'open' || sessionIds.length === 0) return seats;
  const rows = await db
    .select({
      sessionId: tableSessionSignups.sessionId,
      playerId: tableSessionSignups.playerId,
      status: tableSessionSignups.status,
      username: publicName(profiles.username),
    })
    .from(tableSessionSignups)
    .innerJoin(profiles, eq(profiles.id, tableSessionSignups.playerId))
    .where(inArray(tableSessionSignups.sessionId, sessionIds))
    .orderBy(asc(tableSessionSignups.createdAt), asc(tableSessionSignups.playerId));
  for (const sessionId of sessionIds) {
    const here = rows.filter((row) => row.sessionId === sessionId);
    const waitingRows = here.filter((row) => row.status === 'waiting');
    const placeOf = (playerId: string) => {
      const index = waitingRows.findIndex((row) => row.playerId === playerId);
      return index < 0 ? null : index + 1;
    };
    const mine = viewer.playerId
      ? (here.find((row) => row.playerId === viewer.playerId)?.status ?? null)
      : null;
    seats.set(sessionId, {
      size: sessionSize(table),
      going: here.length - waitingRows.length,
      waiting: waitingRows.length,
      mine,
      position: mine === 'waiting' ? placeOf(viewer.playerId!) : null,
      people: viewer.gm
        ? [...here.filter((row) => row.status === 'going'), ...waitingRows].map((row) => ({
            playerId: row.playerId,
            username: row.username,
            status: row.status,
            position: placeOf(row.playerId),
          }))
        : null,
    });
  }
  return seats;
}

/**
 * The rows of `listSessions` with the places of each session ahead (`seats`), for a campanha
 * aberta; every other table, and every session that passed, has none.
 */
export async function withSeats<T extends { id: string; status: string; startsAt: Date }>(
  db: AnyDb,
  table: Pick<Table, 'kind' | 'sessionSize' | 'capacity'>,
  rows: T[],
  viewer: { gm: boolean; playerId: string | null },
  now: Date,
): Promise<(T & { seats: SessionSeats | null })[]> {
  const ahead = rows.filter((row) => row.status === 'scheduled' && row.startsAt > now);
  const seats = await sessionSeatsOf(
    db,
    table,
    ahead.map((row) => row.id),
    viewer,
  );
  return rows.map((row) => ({ ...row, seats: seats.get(row.id) ?? null }));
}
