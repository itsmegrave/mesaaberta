import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  notifications,
  profiles,
  registrations,
  systems,
  tableSessionSignups,
  tableSessions,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import {
  addToSession,
  leaveSession,
  removeFromSession,
  sessionSeatsOf,
  signUpForSession,
} from '@mesaaberta/core/server/tables/session-signups';
import { syncTableSessions } from '@mesaaberta/core/server/tables/sessions';
import { leaveTable, removePlayer } from '@mesaaberta/core/server/registrations/service';
import { notificationHandler } from '@mesaaberta/core/server/events/notifications';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { listCalendarTables } from '@mesaaberta/core/server/calendar/feed';
import { readTableCalendar } from '@mesaaberta/core/server/calendar/table';
import { sendSessionReminders } from '@mesaaberta/core/server/notifications/reminders';
import { createInviteHandler } from '@mesaaberta/core/server/events/invites';
import type { SupabaseAdmin } from '@mesaaberta/core/server/auth/admin-client';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000053${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const ana = person(2);
const bia = person(3);
const caio = person(4);
const davi = person(5);
const stranger = person(6);
// Fridays at 20:00 in São Paulo (23:00 UTC), from 6 November 2026.
const first = new Date('2026-11-06T23:00:00Z');
const now = new Date('2026-11-01T12:00:00Z');
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm.id, username: 'mestra-aberta' },
    { id: ana.id, username: 'ana-aberta' },
    { id: bia.id, username: 'bia-aberta' },
    { id: caio.id, username: 'caio-aberta' },
    { id: davi.id, username: 'davi-aberta' },
    { id: stranger.id, username: 'fora-aberta' },
  ]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(events));

/** An active weekly campanha aberta, two places a session, Ana, Bia, Caio and Davi on the roster. */
async function openCampaign(over: Partial<typeof gameTables.$inferInsert> = {}) {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `aberta-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'open',
      recurrence: 'FREQ=WEEKLY',
      capacity: 10,
      sessionSize: 2,
      startsAt: first,
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm.id,
      systemId: system.id,
      status: 'active',
      ...over,
    })
    .returning();
  await test.db.insert(registrations).values(
    [ana, bia, caio, davi].map((p) => ({
      tableId: table.id,
      playerId: p.id,
      status: 'confirmed' as const,
    })),
  );
  await syncTableSessions(test.db, [table.id]);
  const sessions = await test.db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(eq(tableSessions.tableId, table.id))
    .orderBy(asc(tableSessions.startsAt));
  return { table, session: sessions[0].id, later: sessions[1].id };
}

const signups = async (sessionId: string) =>
  (
    await test.db
      .select({ playerId: tableSessionSignups.playerId, status: tableSessionSignups.status })
      .from(tableSessionSignups)
      .where(eq(tableSessionSignups.sessionId, sessionId))
      .orderBy(asc(tableSessionSignups.createdAt))
  ).map(
    (row) =>
      `${row.playerId === ana.id ? 'ana' : row.playerId === bia.id ? 'bia' : row.playerId === caio.id ? 'caio' : 'davi'}:${row.status}`,
  );

const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

describe('a campanha aberta’s places per session', () => {
  it('plays first come up to the session size, then waits, in order', async () => {
    const { table, session } = await openCampaign();
    for (const [i, p] of [ana, bia, caio, davi].entries())
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));

    expect(await signups(session)).toEqual([
      'ana:going',
      'bia:going',
      'caio:waiting',
      'davi:waiting',
    ]);
    const seats = await sessionSeatsOf(test.db, table, [session], { gm: false, playerId: davi.id });
    expect(seats.get(session)).toMatchObject({
      size: 2,
      going: 2,
      waiting: 2,
      mine: 'waiting',
      position: 2,
      people: null,
    });
  });

  it('signing up twice changes nothing', async () => {
    const { table, session } = await openCampaign();
    await signUpForSession(test.db, ana, table.slug, { sessionId: session }, now);
    const again = await signUpForSession(test.db, ana, table.slug, { sessionId: session }, now);
    expect(again.eventIds).toEqual([]);
    expect(await signups(session)).toEqual(['ana:going']);
  });

  it('when someone who plays leaves, the first who waits takes the place and hears of it', async () => {
    const { table, session } = await openCampaign();
    for (const [i, p] of [ana, bia, caio, davi].entries())
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));
    await test.db.delete(events);

    const { eventIds } = await leaveSession(test.db, ana, table.slug, { sessionId: session }, now);

    expect(await signups(session)).toEqual(['bia:going', 'caio:going', 'davi:waiting']);
    const recorded = await test.db.select().from(events).orderBy(asc(events.createdAt));
    expect(eventIds).toHaveLength(2);
    expect(recorded.map((e) => [e.type, (e.payload as { by?: string }).by ?? null])).toEqual([
      ['SessionSignupLeft', null],
      ['SessionSignedUp', 'waitlist'],
    ]);

    // Caio, who moved up, gets the bell; Ana, who left, nothing.
    for (const event of recorded)
      await notificationHandler.handle(event as unknown as StoredEvent, test.db);
    const bells = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.eventId, recorded[1].id));
    expect(bells.map((b) => [b.recipientId, b.type])).toEqual([[caio.id, 'session_signup_seated']]);
  });

  it('leaving the waiting list moves nobody', async () => {
    const { table, session } = await openCampaign();
    for (const [i, p] of [ana, bia, caio].entries())
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));
    await leaveSession(test.db, caio, table.slug, { sessionId: session }, now);
    expect(await signups(session)).toEqual(['ana:going', 'bia:going']);
  });

  it('only someone on the roster signs up, only at a campanha aberta, and only for a session ahead', async () => {
    const { table, session } = await openCampaign();
    await expect(
      signUpForSession(test.db, stranger, table.slug, { sessionId: session }, now),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(
      signUpForSession(
        test.db,
        ana,
        table.slug,
        { sessionId: session },
        new Date(first.getTime() + 1),
      ),
    ).rejects.toBeInstanceOf(Invalid);

    const other = await openCampaign({ kind: 'campaign', sessionSize: null });
    await expect(
      signUpForSession(test.db, ana, other.table.slug, { sessionId: other.session }, now),
    ).rejects.toBeInstanceOf(Forbidden);
    // A session of another table is not found here.
    await expect(
      signUpForSession(test.db, ana, table.slug, { sessionId: other.session }, now),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('quem mestra puts someone in a full session, moves one up from the line, and takes one out', async () => {
    const { table, session } = await openCampaign();
    for (const [i, p] of [ana, bia, caio].entries())
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));

    await addToSession(test.db, gm, table.slug, { sessionId: session, playerId: caio.id }, now);
    await addToSession(test.db, gm, table.slug, { sessionId: session, playerId: davi.id }, at(10));
    expect(await signups(session)).toEqual(['ana:going', 'bia:going', 'caio:going', 'davi:going']);

    await test.db.delete(events);
    await removeFromSession(test.db, gm, table.slug, { sessionId: session, playerId: ana.id }, now);
    expect(await signups(session)).toEqual(['bia:going', 'caio:going', 'davi:going']);
    const [left] = await test.db.select().from(events);
    await notificationHandler.handle(left as unknown as StoredEvent, test.db);
    const bells = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.eventId, left.id));
    expect(bells.map((b) => [b.recipientId, b.type])).toEqual([[ana.id, 'session_signup_removed']]);

    const seats = await sessionSeatsOf(test.db, table, [session], { gm: true, playerId: null });
    expect(seats.get(session)?.people?.map((p) => p.username)).toEqual([
      'bia-aberta',
      'caio-aberta',
      'davi-aberta',
    ]);
  });

  it('only quem mestra puts people in, and only people on the roster', async () => {
    const { table, session } = await openCampaign();
    await expect(
      addToSession(test.db, ana, table.slug, { sessionId: session, playerId: bia.id }, now),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(
      addToSession(test.db, gm, table.slug, { sessionId: session, playerId: stranger.id }, now),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('leaving the table, or being removed from it, frees every session ahead for whoever waited', async () => {
    // Leaving and removing free the sessions after the real clock's now: pin it before the first
    // session (6 November 2026), or the test stops passing once that date goes by.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    onTestFinished(() => void vi.useRealTimers());
    const { table, session, later } = await openCampaign();
    for (const [i, p] of [ana, bia, caio, davi].entries()) {
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));
      await signUpForSession(test.db, p, table.slug, { sessionId: later }, at(i));
    }

    await leaveTable(test.db, ana, table.slug);
    expect(await signups(session)).toEqual(['bia:going', 'caio:going', 'davi:waiting']);
    expect(await signups(later)).toEqual(['bia:going', 'caio:going', 'davi:waiting']);

    await removePlayer(test.db, gm, table.slug, bia.id);
    expect(await signups(session)).toEqual(['caio:going', 'davi:going']);
    const moved = await test.db
      .select()
      .from(events)
      .where(and(eq(events.type, 'SessionSignedUp')));
    expect(moved.filter((e) => (e.payload as { by: string }).by === 'waitlist')).toHaveLength(4);
  });

  it('a table that is not a campanha aberta has no places', async () => {
    const { table, session } = await openCampaign({ kind: 'campaign', sessionSize: null });
    const seats = await sessionSeatsOf(test.db, table, [session], { gm: true, playerId: null });
    expect(seats.size).toBe(0);
  });
});

describe('a campanha aberta in each player’s calendar', () => {
  it('has only the sessions a player plays, once anyone signs up; quem mestra keeps the whole table', async () => {
    const { table, session, later } = await openCampaign();
    // Nobody signed up yet: everyone on the roster has the whole table, as before.
    expect((await readTableCalendar(test.db, bia, table.slug))?.recurrence).toBe('FREQ=WEEKLY');

    await signUpForSession(test.db, ana, table.slug, { sessionId: later }, now);

    const mine = await readTableCalendar(test.db, ana, table.slug);
    expect(mine).toMatchObject({ recurrence: null, until: null });
    expect(mine?.sessions?.map((s) => s.startsAt)).toHaveLength(1);
    expect(mine?.startsAt.getTime()).toBeGreaterThan(first.getTime());
    expect(mine?.sessions?.[0]).not.toHaveProperty('going');
    // Bia plays none of them: nothing goes in her calendar, and the button answers 404.
    expect(await readTableCalendar(test.db, bia, table.slug)).toBeNull();
    expect((await readTableCalendar(test.db, gm, table.slug))?.recurrence).toBe('FREQ=WEEKLY');

    const feed = (who: Actor) =>
      listCalendarTables(test.db, who.id, now).then((tables) =>
        tables.filter((t) => t.id === table.id),
      );
    expect(await feed(ana)).toMatchObject([{ recurrence: null }]);
    expect((await feed(ana))[0]).not.toHaveProperty('gmId');
    expect(await feed(bia)).toEqual([]);
    expect(await feed(gm)).toMatchObject([{ recurrence: 'FREQ=WEEKLY' }]);
    void session;
  });

  it('puts a new calendar copy out (a higher sequence) when who plays changes, not when someone waits', async () => {
    const { table, session } = await openCampaign();
    const sequence = async () =>
      (
        await test.db
          .select({ n: gameTables.icalSequence })
          .from(gameTables)
          .where(eq(gameTables.id, table.id))
      )[0].n;
    const start = await sequence();
    await signUpForSession(test.db, ana, table.slug, { sessionId: session }, at(0));
    await signUpForSession(test.db, bia, table.slug, { sessionId: session }, at(1));
    expect(await sequence()).toBe(start + 2);
    await signUpForSession(test.db, caio, table.slug, { sessionId: session }, at(2));
    expect(await sequence()).toBe(start + 2);
    // Ana leaves and Caio moves up: two changes.
    await leaveSession(test.db, ana, table.slug, { sessionId: session }, now);
    expect(await sequence()).toBe(start + 4);
  });

  it('reminds only quem mestra and those who play the session', async () => {
    const { table, session } = await openCampaign();
    for (const [i, p] of [ana, bia, caio].entries())
      await signUpForSession(test.db, p, table.slug, { sessionId: session }, at(i));

    await sendSessionReminders(test.db, new Date(first.getTime() - 2 * 3600 * 1000));

    const reminded = (
      await test.db
        .select({ recipientId: notifications.recipientId, metadata: notifications.metadata })
        .from(notifications)
        .where(eq(notifications.type, 'session_reminder'))
    )
      .filter((row) => (row.metadata as { tableId: string }).tableId === table.id)
      .map((row) => row.recipientId)
      .sort();
    expect(reminded).toEqual([gm.id, ana.id, bia.id].sort());
  });

  it('mails the player the sessions they play, and cancels when they play none', async () => {
    const { table, session } = await openCampaign();
    const bodies: { to: string[]; subject: string; attachments?: { content: string }[] }[] = [];
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const admin: SupabaseAdmin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email: 'ana@example.com' } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      },
    };
    const handler = createInviteHandler(
      {
        RESEND_API_KEY: 're_test',
        RESEND_FROM: 'Mesa Aberta <no-reply@mesaaberta.app>',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
        APP_ORIGIN: 'https://mesaaberta.app',
        CALENDAR_UID_DOMAIN: 'mesaaberta.app',
      },
      request,
      admin,
    );
    const latest = async () =>
      (await test.db.select().from(events).orderBy(desc(events.createdAt)).limit(1))[0];
    const ics = (n: number) => Buffer.from(bodies[n].attachments![0].content, 'base64').toString();

    await signUpForSession(test.db, ana, table.slug, { sessionId: session }, now);
    await handler.handle((await latest()) as unknown as StoredEvent, test.db);
    expect(bodies[0].subject).toBe(`Você joga: ${table.title}`);
    expect(ics(0)).toContain('METHOD:REQUEST');
    expect(ics(0)).not.toContain('RRULE');

    // Waiting for a session sends nothing.
    await signUpForSession(test.db, bia, table.slug, { sessionId: session }, at(1));
    await signUpForSession(test.db, caio, table.slug, { sessionId: session }, at(2));
    await handler.handle((await latest()) as unknown as StoredEvent, test.db);
    expect(bodies).toHaveLength(1);

    await test.db.delete(events);
    await leaveSession(test.db, ana, table.slug, { sessionId: session }, now);
    const [left] = await test.db.select().from(events).where(eq(events.type, 'SessionSignupLeft'));
    await handler.handle(left as unknown as StoredEvent, test.db);
    expect(bodies[1].subject).toBe(`Fora da sessão: ${table.title}`);
    expect(ics(1)).toContain('METHOD:CANCEL');
  });
});
