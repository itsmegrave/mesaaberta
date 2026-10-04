import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { MAX_ATTEMPTS } from '../events/dispatcher';
import { recordEvent } from '../events/outbox';
import type { Handler } from '../events/types';
import type { Actor } from '../auth/policy';
import { eventQueue, failedEventCount } from './event-queue';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const admin: Actor = {
  id: '00000000-0000-4000-8000-000000000903',
  role: 'admin',
  status: 'active',
};
const member: Actor = {
  id: '00000000-0000-4000-8000-000000000904',
  role: 'member',
  status: 'active',
};
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const handlers: Handler[] = [
  { name: 'invite', types: ['TableCreated'], handle: async () => {} },
  { name: 'bell', types: ['TableCreated', 'TableDisabled'], handle: async () => {} },
];
const ids: Record<string, string> = {};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: admin.id, username: 'admin', role: 'admin' });
  const make = async (name: string, type: 'TableCreated' | 'TableDisabled' = 'TableCreated') => {
    ids[name] = await recordEvent(test.db, { type, actorId: admin.id, payload }, { now });
    return ids[name];
  };
  const set = (name: string, values: Partial<typeof events.$inferInsert>) =>
    test.db.update(events).set(values).where(eq(events.id, ids[name]));

  await make('failed');
  await set('failed', {
    attempts: MAX_ATTEMPTS,
    failedAt: now,
    lastError: 'Error: boom',
    handledBy: ['invite'],
  });
  await make('retrying');
  await set('retrying', { attempts: 2, nextAttemptAt: new Date(now.getTime() + 60_000) });
  await make('pending');
  await make('running', 'TableDisabled');
  await set('running', { claimedUntil: new Date(now.getTime() + 60_000) });
  await make('processed');
  await set('processed', { processedAt: now, handledBy: ['invite', 'bell'] });
});
afterAll(() => test.close());

const read = (query = '') => eventQueue(test.db, admin, handlers, new URLSearchParams(query), now);

describe('eventQueue', () => {
  it('opens on the events that were given up on, with what went wrong', async () => {
    const queue = await read();

    expect(queue!.status).toBe('failed');
    expect(queue!.rows).toHaveLength(1);
    expect(queue!.rows[0]).toMatchObject({
      id: ids.failed,
      type: 'TableCreated',
      attempts: MAX_ATTEMPTS,
      lastError: 'Error: boom',
      actor: 'admin',
    });
  });

  it('counts each state, and a lease that is held apart from one that ran out', async () => {
    const queue = await read();

    expect(queue!.counts).toEqual({
      failed: 1,
      retrying: 1,
      pending: 1,
      running: 1,
      processed: 1,
    });
    // The lease has run out an hour later: that event waits like any other.
    const later = await eventQueue(
      test.db,
      admin,
      handlers,
      new URLSearchParams('status=pending'),
      new Date(now.getTime() + 3_600_000),
    );
    expect(later!.counts.running).toBe(0);
    expect(later!.counts.pending).toBe(2);
  });

  it('lists each state on its own tab', async () => {
    for (const status of ['retrying', 'pending', 'running', 'processed'] as const) {
      const queue = await read(`status=${status}`);
      expect(queue!.rows.map((row) => row.id)).toEqual([ids[status]]);
    }
  });

  it('says which handlers ran and which are left to run', async () => {
    const [failed] = (await read())!.rows;

    expect(failed.handledBy).toEqual(['invite']);
    expect(failed.remaining).toEqual(['bell']);
    expect((await read('status=processed'))!.rows[0].remaining).toEqual([]);
  });

  it('narrows to one type of event, and ignores a type that is not in the queue', async () => {
    const disabled = await read('status=running&type=TableDisabled');
    expect(disabled!.rows).toHaveLength(1);
    expect(disabled!.types).toEqual(['TableCreated', 'TableDisabled']);

    const other = await read('status=running&type=TableCreated');
    expect(other!.rows).toHaveLength(0);
    expect((await read('type=Nonsense'))!.type).toBe('');
  });

  it('answers null for a page past the last one', async () => {
    expect(await read('page=3')).toBeNull();
  });

  it('is for admins only', async () => {
    await expect(
      eventQueue(test.db, member, handlers, new URLSearchParams(), now),
    ).rejects.toMatchObject({ name: 'Forbidden' });
    await expect(
      eventQueue(test.db, null, handlers, new URLSearchParams(), now),
    ).rejects.toMatchObject({ name: 'Forbidden' });
  });
});

describe('failedEventCount', () => {
  it('counts the events given up on, for the badge in the navigation', async () => {
    expect(await failedEventCount(test.db)).toBe(1);
  });
});
