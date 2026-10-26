import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  follows,
  gameTables,
  notifications,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { followsHandler } from '@mesaaberta/core/server/events/follows';
import type { DomainEvent, StoredEvent } from '@mesaaberta/core/server/events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000b01';
const ana = '00000000-0000-4000-8000-000000000b02';
const bia = '00000000-0000-4000-8000-000000000b03';
const caio = '00000000-0000-4000-8000-000000000b04';
const duda = '00000000-0000-4000-8000-000000000b05';
const tableId = '00000000-0000-4000-8000-000000000b10';
const slug = 'mesa-seguida';
let sequence = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: caio, username: 'caio' },
    { id: duda, username: 'duda' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    id: tableId,
    slug,
    systemId: system.id,
    title: 'Mesa do Dragão',
    kind: 'one_shot',
    capacity: 2,
    startsAt: new Date(Date.now() + 7 * 86_400_000),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
  });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(follows);
  await test.db.delete(registrations);
  await test.db
    .update(profiles)
    .set({ status: 'active', followNotifyTables: true, followNotifySeats: true });
  await test.db.update(gameTables).set({ status: 'active' }).where(eq(gameTables.id, tableId));
});

const stored = (
  event: DomainEvent,
  actorId: string,
  createdAt = new Date('2026-10-01T12:00:00Z'),
): StoredEvent => ({
  ...event,
  id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  actorId,
  createdAt,
  attempts: 0,
});

const handle = (event: StoredEvent) => followsHandler.handle(event, test.db);
const follow = (...followerIds: string[]) =>
  test.db.insert(follows).values(followerIds.map((followerId) => ({ followerId, followeeId: gm })));
const written = async () =>
  (await test.db.select().from(notifications))
    .map((row) => ({ to: row.recipientId, type: row.type, actor: row.actorId, link: row.link }))
    .sort((a, b) => a.to.localeCompare(b.to));

const created = () =>
  stored({ type: 'TableCreated', payload: { tableId, slug, title: 'Mesa do Dragão' } }, gm);
const left = (playerId: string, wasFull = true) =>
  stored(
    {
      type: 'PlayerLeft',
      payload: { tableId, slug, playerId, reason: 'left', ...(wasFull ? { wasFull } : {}) },
    } as DomainEvent,
    playerId,
  );

describe('followsHandler', () => {
  it('tells the active followers who asked when the GM opens a table, once', async () => {
    await follow(ana, bia, caio);
    await test.db.update(profiles).set({ followNotifyTables: false }).where(eq(profiles.id, bia));
    await test.db.update(profiles).set({ status: 'suspended' }).where(eq(profiles.id, caio));

    const event = created();
    await handle(event);
    await handle(event);

    expect(await written()).toEqual([
      { to: ana, type: 'followed_table_opened', actor: gm, link: `/t/${slug}` },
    ]);
  });

  it('says nothing of a table that is no longer open', async () => {
    await follow(ana);
    await test.db.update(gameTables).set({ status: 'disabled' }).where(eq(gameTables.id, tableId));
    await handle(created());
    expect(await written()).toEqual([]);
  });

  it('tells followers of a seat that opened at a full table, never who is there or who left', async () => {
    await follow(ana, bia, caio, duda);
    await test.db.insert(registrations).values([
      { tableId, playerId: bia, status: 'confirmed' },
      { tableId, playerId: caio, status: 'pending' },
    ]);
    await test.db.update(profiles).set({ followNotifySeats: false }).where(eq(profiles.id, duda));

    await handle(left(ana));

    // Ana left; Bia has a seat and Caio asked for one; Duda turned the notice off.
    expect(await written()).toEqual([]);

    await test.db.delete(registrations).where(eq(registrations.playerId, caio));
    await test.db.update(profiles).set({ followNotifySeats: true }).where(eq(profiles.id, duda));
    await handle(left(ana));
    expect((await written()).map((row) => [row.to, row.type, row.actor])).toEqual([
      [caio, 'followed_seat_opened', gm],
      [duda, 'followed_seat_opened', gm],
    ]);
  });

  it('says nothing when the table was not full, or the seat is taken again', async () => {
    await follow(ana);
    await handle(left(bia, false));
    expect(await written()).toEqual([]);

    await test.db.insert(registrations).values([
      { tableId, playerId: bia, status: 'confirmed' },
      { tableId, playerId: caio, status: 'confirmed' },
    ]);
    await handle(left(duda));
    expect(await written()).toEqual([]);
  });

  it('tells a person who started following them, at most once a month per follower', async () => {
    await follow(ana);
    const first = stored({ type: 'FollowStarted', payload: { followeeId: gm } }, ana);
    await handle(first);
    await handle(first);
    expect(await written()).toEqual([
      { to: gm, type: 'follow_started', actor: ana, link: '/u/ana' },
    ]);

    const again = new Date(first.createdAt.getTime() + 10 * 86_400_000);
    await handle(stored({ type: 'FollowStarted', payload: { followeeId: gm } }, ana, again));
    expect(await written()).toHaveLength(1);

    const later = new Date(first.createdAt.getTime() + 31 * 86_400_000);
    await handle(stored({ type: 'FollowStarted', payload: { followeeId: gm } }, ana, later));
    expect(await written()).toHaveLength(2);
  });

  it('says nothing when the follow is gone or either account is suspended', async () => {
    await handle(stored({ type: 'FollowStarted', payload: { followeeId: gm } }, ana));
    await follow(bia);
    await test.db.update(profiles).set({ status: 'suspended' }).where(eq(profiles.id, bia));
    await handle(stored({ type: 'FollowStarted', payload: { followeeId: gm } }, bia));
    await follow(caio);
    await test.db.update(profiles).set({ status: 'suspended' }).where(eq(profiles.id, gm));
    await handle(stored({ type: 'FollowStarted', payload: { followeeId: gm } }, caio));
    expect(await written()).toEqual([]);
  });
});
