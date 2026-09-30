import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { events, profiles } from '../db/schema';
import { Forbidden, Invalid } from '../errors';
import { dispatchEvent, MAX_ATTEMPTS } from '../events/dispatcher';
import { recordEvent } from '../events/outbox';
import type { Handler } from '../events/types';
import { listWork, queueHealth, retryEvent } from './operations';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin = { id: id(1), role: 'admin' as const, status: 'active' as const };
const member = { id: id(2), role: 'member' as const, status: 'active' as const };
const now = new Date('2026-09-30T12:00:00Z');

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: admin.id, username: 'ana', role: 'admin' });
});
afterAll(() => test.close());

const table = { tableId: id(9), slug: 'mesa', title: 'Mesa' };
const record = (createdAt: Date) =>
  recordEvent(
    test.db,
    { type: 'TableCreated', actorId: admin.id, payload: table },
    { now: createdAt },
  );

describe('queue health and the work list', () => {
  it('is empty on a quiet platform', async () => {
    expect(await queueHealth(test.db, now)).toEqual({
      pending: 0,
      retrying: 0,
      failed: 0,
      oldestPendingSeconds: null,
      byType: [],
    });
    expect(await listWork(test.db)).toEqual([]);
  });

  it('counts pending, retrying and failed, and dates the oldest wait', async () => {
    const oldest = await record(new Date('2026-09-30T11:00:00Z'));
    await record(new Date('2026-09-30T11:30:00Z'));
    const retrying = await record(new Date('2026-09-30T11:45:00Z'));
    const failed = await record(new Date('2026-09-30T10:00:00Z'));
    const done = await record(new Date('2026-09-30T09:00:00Z'));
    await test.db
      .update(events)
      .set({ attempts: 2, lastError: 'Error: boom' })
      .where(eq(events.id, retrying));
    await test.db
      .update(events)
      .set({
        attempts: MAX_ATTEMPTS,
        failedAt: now,
        lastError: 'Error: Resend answered 500',
        handledBy: ['bell'],
      })
      .where(eq(events.id, failed));
    await test.db.update(events).set({ processedAt: now }).where(eq(events.id, done));

    expect(await queueHealth(test.db, now)).toEqual({
      pending: 3,
      retrying: 1,
      failed: 1,
      oldestPendingSeconds: 3600,
      byType: [{ type: 'TableCreated', pending: 3, failed: 1 }],
    });

    const work = await listWork(test.db);
    expect(work.map((row) => [row.id, row.state])).toEqual([
      [failed, 'failed'],
      [oldest, 'pending'],
      [expect.any(String), 'pending'],
      [retrying, 'pending'],
    ]);
    expect(work[0]).toMatchObject({
      attempts: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      handledBy: ['bell'],
      lastError: 'Error: Resend answered 500',
    });
    // Delivery, not content: the payload is not part of a row.
    expect(Object.keys(work[0])).not.toContain('payload');
  });
});

describe('retrying a failed event', () => {
  it('is for admins only', async () => {
    await expect(retryEvent(test.db, member, id(404))).rejects.toBeInstanceOf(Forbidden);
    await expect(retryEvent(test.db, null, id(404))).rejects.toBeDefined();
  });

  it('refuses what is not failed, and what is not there', async () => {
    const [pending] = (await listWork(test.db)).filter((row) => row.state === 'pending');
    await expect(retryEvent(test.db, admin, pending.id)).rejects.toBeInstanceOf(Invalid);
    await expect(retryEvent(test.db, admin, id(404))).rejects.toMatchObject({
      message: 'not_retryable',
    });
  });

  it('runs only the handlers that have not succeeded, once, however often it is asked', async () => {
    const eventId = await record(new Date('2026-09-30T08:00:00Z'));
    const sent = vi.fn();
    const bell = vi.fn();
    const handlers: Handler[] = [
      { name: 'bell', types: ['TableCreated'], handle: async () => void bell() },
      {
        name: 'email',
        types: ['TableCreated'],
        handle: async () => {
          if (sent.mock.calls.length === 0 && failing) throw new Error('Resend answered 500');
          sent();
        },
      },
    ];
    let failing = true;
    // Every attempt fails at the e-mail until the event is given up on.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await dispatchEvent(
        test.db,
        handlers,
        eventId,
        new Date(now.getTime() + attempt * 4_000_000),
      );
    }
    const [given] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(given.failedAt).not.toBeNull();
    expect(given.handledBy).toEqual(['bell']);
    expect(bell).toHaveBeenCalledTimes(1);

    failing = false;
    const auditId = await retryEvent(test.db, admin, eventId);
    await expect(retryEvent(test.db, admin, eventId)).rejects.toMatchObject({
      message: 'not_retryable',
    });
    await dispatchEvent(test.db, handlers, eventId, new Date(Date.now() + 1000));
    await dispatchEvent(test.db, handlers, eventId, new Date(Date.now() + 2000));

    const [done] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(done.processedAt).not.toBeNull();
    expect(done.failedAt).toBeNull();
    expect(done.handledBy.sort()).toEqual(['bell', 'email']);
    expect(bell).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenCalledTimes(1);
    // A finished event has nothing to retry.
    await expect(retryEvent(test.db, admin, eventId)).rejects.toMatchObject({
      message: 'not_retryable',
    });

    const [audit] = await test.db.select().from(events).where(eq(events.id, auditId));
    expect(audit).toMatchObject({ type: 'QueueRetryRequested', actorId: admin.id });
    expect(audit.payload).toEqual({ eventId, eventType: 'TableCreated' });
  });
});
