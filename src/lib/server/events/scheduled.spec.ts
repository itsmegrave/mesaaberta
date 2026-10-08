import { expect, it, vi } from 'vitest';
import { runScheduled } from './scheduled';
import { logger } from '../logger';
it('routes the daily and five-minute cron independently even when both fire at 04:00 UTC', async () => {
  const sweeper = vi.fn(),
    importer = vi.fn(),
    env = {};
  await runScheduled({ cron: '0 4 * * *', scheduledTime: 42 }, env, {
    log: logger,
    sweeper,
    importer,
  });
  expect(importer).toHaveBeenCalledOnce();
  expect(sweeper).not.toHaveBeenCalled();
  await runScheduled({ cron: '*/5 * * * *', scheduledTime: 42 }, env, {
    log: logger,
    sweeper,
    importer,
  });
  expect(sweeper).toHaveBeenCalledOnce();
  expect(importer).toHaveBeenCalledOnce();
  await runScheduled({ cron: '0 1 * * *', scheduledTime: 42 }, env, {
    log: logger,
    sweeper,
    importer,
  });
  expect(sweeper).toHaveBeenCalledOnce();
  expect(importer).toHaveBeenCalledOnce();
});
