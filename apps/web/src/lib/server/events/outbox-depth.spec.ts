import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { events } from '@mesaaberta/core/server/db/schema';
import { outboxDepth } from '@mesaaberta/core/server/events/outbox-depth';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-24T12:00:00Z');
const row = (over: Partial<typeof events.$inferInsert> = {}) => ({
  type: 'test.event',
  payload: {},
  ...over,
});

beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(events);
});

describe('outboxDepth', () => {
  it('is empty for an empty outbox', async () => {
    expect(await outboxDepth(test.db, now)).toEqual({
      pending: 0,
      failed: 0,
      oldestPendingSeconds: 0,
    });
  });

  it('counts pending and failed apart and ignores delivered events', async () => {
    await test.db
      .insert(events)
      .values([
        row({ nextAttemptAt: new Date('2026-10-24T11:58:00Z') }),
        row({ nextAttemptAt: new Date('2026-10-24T11:59:00Z') }),
        row({ failedAt: new Date('2026-10-24T11:00:00Z') }),
        row({ processedAt: new Date('2026-10-24T11:30:00Z') }),
      ]);

    expect(await outboxDepth(test.db, now)).toEqual({
      pending: 2,
      failed: 1,
      oldestPendingSeconds: 120,
    });
  });
});
