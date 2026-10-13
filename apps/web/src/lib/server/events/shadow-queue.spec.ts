import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { events, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Logger } from '@mesaaberta/core/server/logger';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { registerShadowQueue } from '@mesaaberta/core/server/events/shadow-queue';
import type { Handler } from '@mesaaberta/core/server/events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-10T12:00:00Z');
const actor = '00000000-0000-4000-8000-000000000903';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };

const logger = () => {
  const warn = vi.fn();
  return { warn, logger: { info() {}, warn, error() {}, debug() {} } as unknown as Logger };
};
const handler: Handler = { name: 'mail', types: ['TableCreated'], handle: async () => {} };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: actor, username: 'bia' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

const record = () =>
  recordEvent(test.db, { type: 'TableCreated', actorId: actor, payload }, { now: t0 });

describe('the shadow queue producer', () => {
  it('publishes only the reference when the resolver hands over a queue', async () => {
    const send = vi.fn(async () => {});
    registerShadowQueue(test.db, async () => ({ send }));
    const id = await record();

    await dispatchEvent(test.db, [handler], id, t0, logger().logger);

    expect(send).toHaveBeenCalledExactlyOnceWith(
      { eventId: id, type: 'TableCreated', version: 1 },
      { contentType: 'json' },
    );
  });

  it('publishes nothing when the resolver answers null (flag off or no binding)', async () => {
    const send = vi.fn(async () => {});
    registerShadowQueue(test.db, async () => null);
    const id = await record();

    const result = await dispatchEvent(test.db, [handler], id, t0, logger().logger);

    expect(send).not.toHaveBeenCalled();
    expect(result.status).toBe('done');
  });

  it('still delivers, and warns, when the queue send fails or the resolver throws', async () => {
    const failing = logger();
    registerShadowQueue(test.db, async () => ({
      send: async () => {
        throw new Error('queue down');
      },
    }));
    const first = await record();
    expect((await dispatchEvent(test.db, [handler], first, t0, failing.logger)).status).toBe(
      'done',
    );
    expect(failing.warn).toHaveBeenCalledWith(
      'queue shadow publish failed',
      expect.objectContaining({ event: 'queue.shadow.failed', eventId: first }),
    );

    registerShadowQueue(test.db, async () => {
      throw new Error('flags down');
    });
    const second = await record();
    expect((await dispatchEvent(test.db, [handler], second, t0, logger().logger)).status).toBe(
      'done',
    );
  });

  it('does not publish for an event another dispatcher holds', async () => {
    const send = vi.fn(async () => {});
    registerShadowQueue(test.db, async () => ({ send }));
    const id = await record();
    await dispatchEvent(test.db, [handler], id, t0, logger().logger);
    send.mockClear();

    const again = await dispatchEvent(test.db, [handler], id, t0, logger().logger);

    expect(again).toEqual({ status: 'skipped', reason: 'processed' });
    expect(send).not.toHaveBeenCalled();
  });
});
