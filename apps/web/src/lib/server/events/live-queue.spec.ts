import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { registerLiveQueue } from '@mesaaberta/core/server/events/live-queue';
import { events, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '@mesaaberta/core/server/logger';
import { dispatchEvent, forceEvent, sweepEvents } from '@mesaaberta/core/server/events/dispatcher';
import { createEventExecutor } from '@mesaaberta/core/server/events/executor';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { registerShadowQueue } from '@mesaaberta/core/server/events/shadow-queue';
import type { Handler } from '@mesaaberta/core/server/events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-12T12:00:00Z');
const actor = '00000000-0000-4000-8000-000000000904';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };
const log = { info() {}, warn() {}, error() {}, debug() {} } as unknown as Logger;

const ANALYTICS = 'mixpanel-product-events-v1';
const setup = () => {
  const mail = vi.fn(async () => {});
  const analytics = vi.fn(async () => {});
  const handlers: Handler[] = [
    { name: 'mail', types: ['TableCreated'], handle: mail },
    { name: ANALYTICS, types: ['TableCreated'], handle: analytics },
  ];
  const send = vi.fn(async () => {});
  return { mail, analytics, handlers, send };
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: actor, username: 'duda' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
  registerLiveQueue(test.db, async () => null);
  registerShadowQueue(test.db, async () => null);
});

const record = () =>
  recordEvent(test.db, { type: 'TableCreated', actorId: actor, payload }, { now: t0 });
const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];

describe('a live event class on the queue', () => {
  it('leaves the named handlers pending, releases the lease and publishes one reference', async () => {
    const { mail, analytics, handlers, send } = setup();
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: [ANALYTICS] }));
    // The shadow canary on the same request must not add a second message.
    registerShadowQueue(test.db, async () => ({ send }));
    const id = await record();

    const result = await dispatchEvent(test.db, handlers, id, t0, log);

    expect(result).toEqual({ status: 'deferred' });
    expect(mail).toHaveBeenCalledOnce();
    expect(analytics).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledExactlyOnceWith(
      { eventId: id, type: 'TableCreated', version: 1 },
      { contentType: 'json' },
    );
    expect(await row(id)).toMatchObject({
      handledBy: ['mail'],
      processedAt: null,
      claimedUntil: null,
      attempts: 0,
    });
  });

  it('is finished by the consumer, which runs only its own handlers', async () => {
    const { mail, analytics, handlers, send } = setup();
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: [ANALYTICS] }));
    const id = await record();
    await dispatchEvent(test.db, handlers, id, t0, log);

    const execute = createEventExecutor(test.db, handlers, {
      log,
      options: { only: [ANALYTICS], fenced: true },
    });
    const outcome = await execute({ eventId: id, type: 'TableCreated', version: 1 });

    expect(outcome).toEqual({ status: 'done' });
    expect(mail).toHaveBeenCalledOnce();
    expect(analytics).toHaveBeenCalledOnce();
    expect(await row(id)).toMatchObject({ handledBy: ['mail', ANALYTICS] });
    expect((await row(id)).processedAt).not.toBeNull();
    // A duplicate delivery runs nothing.
    expect(await execute({ eventId: id, type: 'TableCreated', version: 1 })).toEqual({
      status: 'done',
    });
    expect(analytics).toHaveBeenCalledOnce();
  });

  it('a consumer that arrives first runs its handlers and leaves the rest due', async () => {
    const { mail, analytics, handlers } = setup();
    const id = await record();

    const execute = createEventExecutor(test.db, handlers, { log, options: { only: [ANALYTICS] } });
    expect(await execute({ eventId: id, type: 'TableCreated', version: 1 })).toEqual({
      status: 'done',
    });

    expect(mail).not.toHaveBeenCalled();
    expect(await row(id)).toMatchObject({ handledBy: [ANALYTICS], processedAt: null });
    expect(await dispatchEvent(test.db, handlers, id, t0, log)).toEqual({ status: 'done' });
    expect(mail).toHaveBeenCalledOnce();
    expect(analytics).toHaveBeenCalledOnce();
  });

  it('the sweeper runs what the queue never delivered', async () => {
    const { analytics, handlers, send } = setup();
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: [ANALYTICS] }));
    const id = await record();
    await dispatchEvent(test.db, handlers, id, t0, log);

    // The Cron Trigger's connection registers no routing.
    registerLiveQueue(test.db, async () => null);
    expect(await sweepEvents(test.db, handlers, t0, 50, log)).toBe(1);

    expect(analytics).toHaveBeenCalledOnce();
    expect((await row(id)).processedAt).not.toBeNull();
  });

  it('publishes nothing when one of its own handlers fails: the retry runs everything', async () => {
    const { analytics, handlers, send } = setup();
    handlers[0] = {
      ...handlers[0],
      handle: async () => {
        throw new Error('smtp down');
      },
    };
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: [ANALYTICS] }));
    const id = await record();

    const result = await dispatchEvent(test.db, handlers, id, t0, log);

    expect(result.status).toBe('retry');
    expect(send).not.toHaveBeenCalled();
    expect(analytics).not.toHaveBeenCalled();
    expect(await row(id)).toMatchObject({ attempts: 1, handledBy: [] });
  });

  it('still hands over when the queue send fails, and runs everything when the routing throws', async () => {
    const first = setup();
    registerLiveQueue(test.db, async () => ({
      queue: {
        send: async () => {
          throw new Error('queue down');
        },
      },
      handlers: [ANALYTICS],
    }));
    const lostMessage = await record();
    expect(await dispatchEvent(test.db, first.handlers, lostMessage, t0, log)).toEqual({
      status: 'deferred',
    });
    expect((await row(lostMessage)).processedAt).toBeNull();

    const second = setup();
    registerLiveQueue(test.db, async () => {
      throw new Error('flags down');
    });
    const inline = await record();
    expect(await dispatchEvent(test.db, second.handlers, inline, t0, log)).toEqual({
      status: 'done',
    });
    expect(second.analytics).toHaveBeenCalledOnce();
  });

  it("an admin's run-it-now runs every handler itself", async () => {
    const { analytics, handlers, send } = setup();
    registerLiveQueue(test.db, async () => ({ queue: { send }, handlers: [ANALYTICS] }));
    const id = await record();

    expect(await forceEvent(test.db, handlers, id, actor, t0, log)).toBe('processed');

    expect(analytics).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });
});
