import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { createLogger } from '../logger';
import { forceEvent, forceFailedEvents, MAX_ATTEMPTS, RETRY_ALL_LIMIT } from './dispatcher';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-01T12:00:00Z');
const admin = '00000000-0000-4000-8000-000000000902';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const log = createLogger({ write: () => {} });

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: admin, username: 'admin', role: 'admin' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

const record = (at = t0) =>
  recordEvent(test.db, { type: 'TableCreated', actorId: admin, payload }, { now: at });
const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];
const forced = () => test.db.select().from(events).where(eq(events.type, 'EventForced'));
const give = (id: string) =>
  test.db
    .update(events)
    .set({ attempts: MAX_ATTEMPTS, failedAt: t0, lastError: 'Error: boom' })
    .where(eq(events.id, id));

const handler = (name: string, fails = false): Handler & { calls: number } => {
  const self = {
    name,
    types: ['TableCreated'] as const,
    calls: 0,
    handle: async () => {
      self.calls++;
      if (fails) throw new Error('boom');
    },
  };
  return self;
};
const later = new Date(t0.getTime() + 60_000);

describe('forceEvent', () => {
  it('runs an event that never ran, and records who asked', async () => {
    const id = await record();
    const ok = handler('ok');

    expect(await forceEvent(test.db, [ok], id, admin, later, log)).toBe('processed');

    expect(ok.calls).toBe(1);
    expect((await row(id)).processedAt).not.toBeNull();
    const [entry] = await forced();
    expect(entry).toMatchObject({
      actorId: admin,
      payload: { eventId: id, eventType: 'TableCreated' },
    });
    // Nothing listens to it: it is done, not left for the sweeper.
    expect(entry.processedAt).not.toBeNull();
  });

  it('does not wait for the backoff of an event that failed and is waiting', async () => {
    const id = await record();
    await test.db
      .update(events)
      .set({ attempts: 2, nextAttemptAt: new Date(later.getTime() + 3_600_000) })
      .where(eq(events.id, id));
    const ok = handler('ok');

    expect(await forceEvent(test.db, [ok], id, admin, later, log)).toBe('processed');
    expect(ok.calls).toBe(1);
  });

  it('gives an event that was given up on a fresh round of attempts', async () => {
    const id = await record();
    await give(id);

    const outcome = await forceEvent(test.db, [handler('bad', true)], id, admin, later, log);

    expect(outcome).toBe('failed');
    expect(await row(id)).toMatchObject({ attempts: 1, failedAt: null, processedAt: null });
    expect((await row(id)).lastError).toContain('boom');
  });

  it('gives up on it again when the fresh round runs out', async () => {
    const id = await record();
    await test.db
      .update(events)
      .set({ attempts: MAX_ATTEMPTS - 1, nextAttemptAt: later })
      .where(eq(events.id, id));

    await forceEvent(test.db, [handler('bad', true)], id, admin, later, log);

    expect((await row(id)).failedAt).not.toBeNull();
  });

  it('does not run again the handlers that already succeeded', async () => {
    const id = await record();
    await test.db
      .update(events)
      .set({ handledBy: ['first'] })
      .where(eq(events.id, id));
    const first = handler('first');
    const second = handler('second');

    await forceEvent(test.db, [first, second], id, admin, later, log);

    expect([first.calls, second.calls]).toEqual([0, 1]);
  });

  it('refuses an event somebody is running at this moment, and leaves it alone', async () => {
    const id = await record();
    await test.db
      .update(events)
      .set({ claimedUntil: new Date(later.getTime() + 60_000) })
      .where(eq(events.id, id));
    const ok = handler('ok');

    expect(await forceEvent(test.db, [ok], id, admin, later, log)).toBe('running');

    expect(ok.calls).toBe(0);
    expect(await forced()).toHaveLength(0);
  });

  it('has nothing to run for a processed event, or one that is not there', async () => {
    const id = await record();
    await test.db.update(events).set({ processedAt: t0 }).where(eq(events.id, id));
    const ok = handler('ok');

    expect(await forceEvent(test.db, [ok], id, admin, later, log)).toBe('already_processed');
    expect(await forceEvent(test.db, [ok], crypto.randomUUID(), admin, later, log)).toBe(
      'not_found',
    );
    expect(ok.calls).toBe(0);
    expect(await forced()).toHaveLength(0);
  });
});

describe('forceFailedEvents', () => {
  it('runs the given-up events, oldest first, and says how many went through', async () => {
    const [a, b] = [await record(t0), await record(new Date(t0.getTime() + 1000))];
    await give(a);
    await give(b);
    const waiting = await record(new Date(t0.getTime() + 2000));

    const result = await forceFailedEvents(test.db, [handler('ok')], admin, later, log);

    expect(result).toEqual({ tried: 2, processed: 2, remaining: 0 });
    // An event that was only waiting is not one of the failed.
    expect((await row(waiting)).processedAt).toBeNull();
    expect(await forced()).toHaveLength(2);
  });

  it('counts those that fail again as tried but not processed', async () => {
    const id = await record();
    await give(id);

    const result = await forceFailedEvents(test.db, [handler('bad', true)], admin, later, log);

    // The fresh round is not used up by one attempt: it waits for the sweeper, not given up on.
    expect(result).toEqual({ tried: 1, processed: 0, remaining: 0 });
  });

  it('takes a bounded batch at a time', async () => {
    for (let n = 0; n < RETRY_ALL_LIMIT + 2; n++) {
      await give(await record(new Date(t0.getTime() + n * 1000)));
    }

    const result = await forceFailedEvents(test.db, [handler('ok')], admin, later, log);

    expect(result).toEqual({
      tried: RETRY_ALL_LIMIT,
      processed: RETRY_ALL_LIMIT,
      remaining: 2,
    });
  });
});
