import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { encryptToken } from '@mesaaberta/core/server/instagram/api';
import { events, instagramAccounts, workerHeartbeats } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { SWEEPER_HEARTBEAT } from '@mesaaberta/core/server/events/heartbeat';
import { runSweeper } from '@mesaaberta/core/server/events/sweeper';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(workerHeartbeats);
  await test.db.delete(instagramAccounts);
  await test.db.delete(events);
});

const log = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});
const env = {
  DATABASE_URL: 'postgres://x',
  INSTAGRAM_APP_ID: 'app',
  INSTAGRAM_APP_SECRET: 'secret',
  INSTAGRAM_TOKEN_KEY: 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=',
  APP_ORIGIN: 'https://mesaaberta.app',
};

describe('the sweeper when the social publisher fails', () => {
  it('still prunes, records its heartbeat and only warns when the stored token cannot be read', async () => {
    // Encrypted with the key that was replaced: decrypting it throws an OperationError.
    await test.db.insert(instagramAccounts).values({
      id: 'mesaaberta',
      userId: '1',
      username: 'mesaaberta',
      token: await encryptToken('long-lived', 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE='),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
    });
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
      'social publish failed',
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
