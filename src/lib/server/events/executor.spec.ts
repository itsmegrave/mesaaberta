import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createMemoryTransport } from '@mesaaberta/events';
import { events, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '../logger';
import { MAX_ATTEMPTS } from './dispatcher';
import { createEventExecutor } from './executor';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const actor = '00000000-0000-4000-8000-000000000903';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const log = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: actor, username: 'caio' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

const record = () =>
  recordEvent(test.db, { type: 'TableCreated', actorId: actor, payload }, { now: new Date(0) });
const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];
const ref = (eventId: string) => ({ eventId, type: 'TableCreated', version: 1 });
const handler = (run: () => Promise<void>): Handler => ({
  name: 'mail',
  types: ['TableCreated'],
  handle: run,
});

describe('createEventExecutor', () => {
  it('reports done once every handler has succeeded', async () => {
    const id = await record();
    const execute = createEventExecutor(test.db, [handler(async () => {})], { log });

    expect(await execute(ref(id))).toEqual({ status: 'done' });
    expect((await row(id)).processedAt).not.toBeNull();
  });

  it('reports a duplicate delivery of a processed event as done, without running handlers again', async () => {
    const id = await record();
    let runs = 0;
    const execute = createEventExecutor(
      test.db,
      [
        handler(async () => {
          runs += 1;
        }),
      ],
      { log },
    );

    await execute(ref(id));
    expect(await execute(ref(id))).toEqual({ status: 'done' });
    expect(runs).toBe(1);
  });

  it('turns a failed handler into a retry with its backoff, and counts the failure', async () => {
    const id = await record();
    const execute = createEventExecutor(
      test.db,
      [
        handler(async () => {
          throw new Error('provider 503');
        }),
      ],
      { log },
    );

    const outcome = await execute(ref(id));

    expect(outcome).toMatchObject({ status: 'retry', afterSeconds: 30 });
    expect((await row(id)).attempts).toBe(1);
  });

  it('reports failed once the attempt cap is reached', async () => {
    const id = await record();
    await test.db
      .update(events)
      .set({ attempts: MAX_ATTEMPTS - 1 })
      .where(eq(events.id, id));
    const execute = createEventExecutor(
      test.db,
      [
        handler(async () => {
          throw new Error('still down');
        }),
      ],
      { log },
    );

    expect(await execute(ref(id))).toMatchObject({ status: 'failed' });
    expect((await row(id)).failedAt).not.toBeNull();
  });

  it('answers a missing event as failed, and one held by another dispatcher as a short retry', async () => {
    const execute = createEventExecutor(test.db, [handler(async () => {})], { log });
    expect(await execute(ref('00000000-0000-4000-8000-0000000000ff'))).toEqual({
      status: 'failed',
      reason: 'event not found',
    });

    const id = await record();
    await test.db
      .update(events)
      .set({ claimedUntil: new Date(Date.now() + 60_000) })
      .where(eq(events.id, id));
    expect(await execute(ref(id))).toMatchObject({ status: 'retry', afterSeconds: 30 });
  });

  it('plugs into a transport: the failure retries after its delay, then completes', async () => {
    const id = await record();
    let calls = 0;
    const execute = createEventExecutor(
      test.db,
      [
        handler(async () => {
          calls += 1;
          if (calls === 1) throw new Error('first attempt fails');
        }),
      ],
      { log, options: { fenced: true } },
    );
    const bus = createMemoryTransport({ executor: execute });

    await bus.transport.enqueue(ref(id));
    const [first] = await bus.drain();
    expect(first.status).toBe('retry');

    // The row's own backoff has to pass before the next claim is due.
    await test.db
      .update(events)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(events.id, id));
    bus.advance(30);
    const [second] = await bus.drain();

    expect(second).toEqual({ status: 'done' });
    expect((await row(id)).processedAt).not.toBeNull();
    expect(bus.deadLetters).toEqual([]);
  });
});
