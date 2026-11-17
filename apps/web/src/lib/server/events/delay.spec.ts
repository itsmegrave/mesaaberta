import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { outboxDelay, reportDelay } from '@mesaaberta/core/server/events/delay';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const minutes = (n: number) => new Date(now.getTime() - n * 60_000);
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const record = (at: Date) =>
  recordEvent(test.db, { type: 'TableCreated', actorId: null, payload }, { now: at });

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

describe('outboxDelay', () => {
  it('counts the due events still waiting past the alert, and how late the oldest is', async () => {
    await record(minutes(40));
    await record(minutes(20));
    await record(minutes(5));
    const done = await record(minutes(60));
    await test.db.update(events).set({ processedAt: now }).where(eq(events.id, done));
    const given = await record(minutes(60));
    await test.db.update(events).set({ failedAt: now }).where(eq(events.id, given));

    expect(await outboxDelay(test.db, now)).toEqual({ delayed: 2, delaySeconds: 40 * 60 });
  });

  it('is nothing when the outbox keeps up', async () => {
    await record(minutes(5));
    expect(await outboxDelay(test.db, now)).toEqual({ delayed: 0, delaySeconds: 0 });
  });
});

describe('reportDelay', () => {
  it('raises an issue only when something is late', async () => {
    const log = { error: vi.fn(), warn: vi.fn() } as never as Parameters<typeof reportDelay>[2];
    await reportDelay(test.db, now, log);
    expect(log.error).not.toHaveBeenCalled();

    await record(minutes(30));
    await reportDelay(test.db, now, log);
    expect(log.error).toHaveBeenCalledWith(
      'event.backlog.delayed',
      expect.objectContaining({ code: 'outbox_delayed', delayed: 1, delaySeconds: 1800 }),
    );
  });
});
