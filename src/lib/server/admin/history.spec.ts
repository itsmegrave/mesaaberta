import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { events, gameTables, profiles, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { recordEvent } from '../events/outbox';
import type { Actor } from '../auth/policy';
import { HISTORY_SHOWN, profileHistory, tableHistory } from './history';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = { id: id(1), role: 'member', status: 'active' } as const;
const bruno = { id: id(2), role: 'member', status: 'active' } as const;
let tableId: string;
let otherTableId: string;
const slug = 'historia';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes));
const record = (
  event: Parameters<typeof recordEvent>[1],
  minutes: number,
  db: typeof test.db = test.db,
) => recordEvent(db, event, { now: at(minutes) });

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana.id, username: 'ana' },
    { id: bruno.id, username: 'bruno' },
    { id: admin.id, username: 'admin', role: 'admin' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const table = (name: string) => ({
    slug: name,
    title: `Mesa ${name}`,
    kind: 'one_shot' as const,
    capacity: 5,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    durationMinutes: 240,
    timezone: 'UTC',
    gmId: ana.id,
    systemId: system.id,
  });
  [{ id: tableId }, { id: otherTableId }] = await test.db
    .insert(gameTables)
    .values([table(slug), table('outra')])
    .returning({ id: gameTables.id });

  const facts = { tableId, slug, title: 'Mesa historia' };
  await record({ type: 'TableCreated', actorId: ana.id, payload: facts }, 1);
  await record(
    {
      type: 'TableUpdated',
      actorId: ana.id,
      payload: { ...facts, changes: { title: { from: 'Antes', to: 'Mesa historia' } } },
    },
    2,
  );
  await record(
    {
      type: 'TableEdited',
      actorId: ana.id,
      payload: { ...facts, changes: { joinDetails: { redacted: true } } },
    },
    3,
  );
  await record(
    { type: 'PlayerJoined', actorId: bruno.id, payload: { ...facts, playerId: bruno.id } },
    4,
  );
  await record({ type: 'TableAwaitingConfirmation', actorId: null, payload: facts }, 5);
  await record(
    {
      type: 'PlayerLeft',
      actorId: admin.id,
      payload: { ...facts, playerId: bruno.id, reason: 'removed' },
    },
    6,
  );
  // Another table's events, and a sign-in (an address: never part of a history).
  await record(
    {
      type: 'TableCreated',
      actorId: ana.id,
      payload: { tableId: otherTableId, slug: 'outra', title: 'Mesa outra' },
    },
    7,
  );
  await record({ type: 'UserSignedIn', actorId: ana.id, payload: { ip: '203.0.113.7' } }, 8);
  await record(
    {
      type: 'AccountBanned',
      actorId: admin.id,
      payload: { profileId: bruno.id, until: null, reportId: null },
    },
    9,
  );
});
afterAll(() => test.close());

describe('tableHistory', () => {
  it('lists what happened to that table, newest first, with who did it', async () => {
    const { entries, more } = await tableHistory(test.db, admin, tableId);

    expect(more).toBe(false);
    expect(entries.map((e) => [e.type, e.actor?.username ?? null])).toEqual([
      ['PlayerLeft', 'admin'],
      ['TableAwaitingConfirmation', null],
      ['PlayerJoined', 'bruno'],
      ['TableEdited', 'ana'],
      ['TableUpdated', 'ana'],
      ['TableCreated', 'ana'],
    ]);
  });

  it('carries what an edit changed, and nothing for an event that is not an edit', async () => {
    const { entries } = await tableHistory(test.db, admin, tableId);
    const byType = (type: string) => entries.find((e) => e.type === type)!;

    expect(byType('TableUpdated').changes).toEqual({
      title: { from: 'Antes', to: 'Mesa historia' },
    });
    expect(byType('TableEdited').changes).toEqual({ joinDetails: { redacted: true } });
    expect(byType('TableCreated').changes).toBeNull();
  });

  it('names the player an event is about, unless they did it themselves', async () => {
    const { entries } = await tableHistory(test.db, admin, tableId);

    // A player joining is their own act; a removal by an admin names who was removed.
    expect(entries.find((e) => e.type === 'PlayerJoined')).toMatchObject({ subject: null });
    expect(entries.find((e) => e.type === 'PlayerLeft')).toMatchObject({
      subject: 'bruno',
      removed: true,
    });
  });

  it('leaves out the events of other tables and the connection log', async () => {
    const { entries } = await tableHistory(test.db, admin, tableId);

    expect(entries.some((e) => e.type === 'UserSignedIn')).toBe(false);
    expect(entries.some((e) => e.table === 'Mesa outra')).toBe(false);
  });

  it('is for admins only', async () => {
    await expect(tableHistory(test.db, ana, tableId)).rejects.toMatchObject({ name: 'Forbidden' });
    await expect(tableHistory(test.db, null, tableId)).rejects.toMatchObject({ name: 'Forbidden' });
  });
});

describe('profileHistory', () => {
  it('lists what a person did, and never the address of their sign-ins', async () => {
    const { entries } = await profileHistory(test.db, admin, ana.id);

    expect(entries.map((e) => [e.type, e.table])).toEqual([
      ['TableCreated', 'Mesa outra'],
      ['TableEdited', 'Mesa historia'],
      ['TableUpdated', 'Mesa historia'],
      ['TableCreated', 'Mesa historia'],
    ]);
    expect(JSON.stringify(entries)).not.toContain('203.0.113.7');
  });

  it('also lists what others did to them, with who did it and to whom', async () => {
    const { entries } = await profileHistory(test.db, admin, bruno.id);

    expect(entries.map((e) => [e.type, e.actor?.username, e.subject])).toEqual([
      ['AccountBanned', 'admin', 'bruno'],
      ['PlayerLeft', 'admin', 'bruno'],
      ['PlayerJoined', 'bruno', null],
    ]);
  });

  it('is for admins only', async () => {
    await expect(profileHistory(test.db, bruno, ana.id)).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });
});

describe('a long history', () => {
  it('shows the newest entries and says there are more', async () => {
    const [crowded] = await test.db
      .insert(profiles)
      .values({ id: id(50), username: 'movimentada' })
      .returning({ id: profiles.id });
    await test.db.insert(events).values(
      Array.from({ length: HISTORY_SHOWN + 5 }, (_, n) => ({
        type: 'ProfileUpdated',
        actorId: crowded.id,
        payload: { profileId: crowded.id, changes: {} },
        createdAt: at(100 + n),
      })),
    );

    const { entries, more } = await profileHistory(test.db, admin, crowded.id);

    expect(entries).toHaveLength(HISTORY_SHOWN);
    expect(more).toBe(true);
    // The newest first: the five oldest are the ones left out.
    expect(entries[0].at).toEqual(at(100 + HISTORY_SHOWN + 4));
  });
});
