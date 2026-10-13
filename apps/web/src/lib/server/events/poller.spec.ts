import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { pollOutbox, type JobExecutor } from '@mesaaberta/events';
import { events, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '../logger';
import { createEventExecutor } from './executor';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-10T12:00:00Z');
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const actor = '00000000-0000-4000-8000-000000000904';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const log = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: actor, username: 'dani' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

const record = (when: Date) =>
  recordEvent(test.db, { type: 'TableCreated', actorId: actor, payload }, { now: when });
const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];
const handler = (run: () => Promise<void> = async () => {}): Handler => ({
  name: 'mail',
  types: ['TableCreated'],
  handle: run,
});

describe('pollOutbox', () => {
  it('hands the due events to the executor, oldest first, and leaves the future ones', async () => {
    const first = await record(at(-30));
    const second = await record(at(-10));
    const later = await record(at(600));
    const seen: string[] = [];
    const executor: JobExecutor = async ({ eventId }) => {
      seen.push(eventId);
      return { status: 'done' };
    };

    const summary = await pollOutbox(test.db, executor, { now: t0 });

    expect(seen).toEqual([first, second]);
    expect(seen).not.toContain(later);
    expect(summary).toEqual({ tried: 2, done: 2, retry: 0, failed: 0 });
  });

  it('skips what is processed, given up on, or held by another dispatcher', async () => {
    const processed = await record(at(-30));
    const givenUp = await record(at(-30));
    const held = await record(at(-30));
    const free = await record(at(-30));
    await test.db.update(events).set({ processedAt: t0 }).where(eq(events.id, processed));
    await test.db.update(events).set({ failedAt: t0 }).where(eq(events.id, givenUp));
    await test.db
      .update(events)
      .set({ claimedUntil: at(120) })
      .where(eq(events.id, held));
    const executor = vi.fn<JobExecutor>().mockResolvedValue({ status: 'done' });

    await pollOutbox(test.db, executor, { now: t0 });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][0].eventId).toBe(free);
  });

  it('does not select a version this build cannot read', async () => {
    const newer = await record(at(-30));
    await test.db.update(events).set({ version: 2 }).where(eq(events.id, newer));
    const executor = vi.fn<JobExecutor>().mockResolvedValue({ status: 'done' });

    expect(await pollOutbox(test.db, executor, { now: t0 })).toMatchObject({ tried: 0 });
    expect(executor).not.toHaveBeenCalled();
  });

  it('respects the limit', async () => {
    for (const offset of [-50, -40, -30]) await record(at(offset));
    const executor = vi.fn<JobExecutor>().mockResolvedValue({ status: 'done' });

    expect(await pollOutbox(test.db, executor, { now: t0, limit: 2 })).toMatchObject({ tried: 2 });
  });

  it('counts a failing handler as a retry, and keeps going', async () => {
    const bad = await record(at(-30));
    const good = await record(at(-20));
    // The first event's handler fails; the second succeeds.
    let call = 0;
    const flaky = handler(async () => {
      call += 1;
      if (call === 1) throw new Error('provider 503');
    });
    const execute = createEventExecutor(test.db, [flaky], { log, options: { fenced: true } });

    const summary = await pollOutbox(test.db, execute, { now: t0 });

    expect(summary).toEqual({ tried: 2, done: 1, retry: 1, failed: 0 });
    expect((await row(bad)).attempts).toBe(1);
    expect((await row(good)).processedAt).not.toBeNull();
  });

  it('is safe to run twice: the second poll finds nothing left', async () => {
    const id = await record(at(-30));
    const execute = createEventExecutor(test.db, [handler()], { log });

    await pollOutbox(test.db, execute, { now: t0 });
    const second = await pollOutbox(test.db, execute, { now: t0 });

    expect(second).toEqual({ tried: 0, done: 0, retry: 0, failed: 0 });
    expect((await row(id)).processedAt).not.toBeNull();
  });
});
