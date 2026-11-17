import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, workerHeartbeats } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { SWEEPER_HEARTBEAT } from '@mesaaberta/core/server/events/heartbeat';
import { runSweeper } from '@mesaaberta/core/server/events/sweeper';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(workerHeartbeats);
  await test.db.delete(events);
});

const log = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});
const env = { DATABASE_URL: 'postgres://x' };

// Whatever connector is installed (a private build brings its own), its failure must stay isolated.
vi.mock('@mesaaberta/core/server/social/index', () => ({
  socialFor: () => ({
    publishDue: async () => {
      throw new Error('the connector cannot read its stored credentials');
    },
  }),
}));

describe('the sweeper when the social publisher fails', () => {
  it('still prunes, records its heartbeat and only warns when the connector throws', async () => {
    const logger = log();
    const close = vi.fn();

    await expect(
      runSweeper(env, {
        open: (() => ({ db: test.db, close })) as never,
        handlers: [],
        log: logger as never,
      }),
    ).resolves.toBe(0);

    expect(logger.warn).toHaveBeenCalledWith(
      'social.publish_failed',
      expect.objectContaining({ code: 'social_publish_failed' }),
    );
    expect(close).toHaveBeenCalled();
    const [beat] = await test.db
      .select()
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.name, SWEEPER_HEARTBEAT));
    expect(beat).toBeTruthy();
  });
});
