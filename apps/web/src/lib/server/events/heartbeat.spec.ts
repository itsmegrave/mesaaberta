import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { workerHeartbeats } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import {
  HEARTBEAT_STALE_AFTER_MS,
  SWEEPER_HEARTBEAT,
  recordHeartbeat,
  workerHealth,
} from '@mesaaberta/core/server/events/heartbeat';
import { runSweeper } from '@mesaaberta/core/server/events/sweeper';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-11T12:00:00Z');
const log = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});

beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(workerHeartbeats);
});

describe('the worker heartbeat', () => {
  it('is unknown until a run has been recorded', async () => {
    expect(await workerHealth(test.db, t0)).toEqual({ status: 'unknown', lastRunAt: null });
  });

  it('is ok right after a run and keeps one row per job', async () => {
    await recordHeartbeat(test.db, SWEEPER_HEARTBEAT, t0);
    await recordHeartbeat(test.db, SWEEPER_HEARTBEAT, new Date(t0.getTime() + 60_000));

    expect(await test.db.select().from(workerHeartbeats)).toHaveLength(1);
    expect(await workerHealth(test.db, new Date(t0.getTime() + 120_000))).toEqual({
      status: 'ok',
      lastRunAt: '2026-10-11T12:01:00.000Z',
    });
  });

  it('goes stale after fifteen minutes without a run', async () => {
    await recordHeartbeat(test.db, SWEEPER_HEARTBEAT, t0);

    const edge = new Date(t0.getTime() + HEARTBEAT_STALE_AFTER_MS);
    expect((await workerHealth(test.db, edge)).status).toBe('ok');
    expect((await workerHealth(test.db, new Date(edge.getTime() + 1))).status).toBe('stale');
  });

  it('never throws: an unreadable table is unknown, an unwritable one only warns', async () => {
    const broken = {
      select: () => {
        throw new Error('down');
      },
      insert: () => {
        throw new Error('down');
      },
    } as never;
    const logger = log();

    expect(await workerHealth(broken, t0)).toEqual({ status: 'unknown', lastRunAt: null });
    await expect(
      recordHeartbeat(broken, SWEEPER_HEARTBEAT, t0, logger as never),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'worker heartbeat failed',
      expect.objectContaining({ code: 'heartbeat_failed' }),
    );
  });

  it('is written by a finished sweep, and not by one that threw', async () => {
    const close = vi.fn();
    await runSweeper({ DATABASE_URL: 'postgres://x' } as never, {
      open: () => ({ db: test.db, close }) as never,
      handlers: [],
      log: log() as never,
    });
    expect((await workerHealth(test.db)).status).toBe('ok');

    await test.db.delete(workerHeartbeats);
    const failing = {
      ...test.db,
      execute: () => {
        throw new Error('boom');
      },
    };
    await runSweeper({ DATABASE_URL: 'postgres://x' } as never, {
      open: () => ({ db: failing, close }) as never,
      handlers: [],
      log: log() as never,
    }).catch(() => undefined);
    expect((await workerHealth(test.db)).status).toBe('unknown');
  });
});
