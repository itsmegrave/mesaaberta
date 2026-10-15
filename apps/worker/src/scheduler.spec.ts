import { describe, expect, it, vi } from 'vitest';
import { DAILY_IMPORT_CRON, SWEEPER_CRON } from '@mesaaberta/core/server/events/scheduled';
import { createScheduler } from './scheduler';

const at = (iso: string) => ({ now: new Date(iso) });
const clock = (start: string) => {
  const state = at(start);
  return {
    state,
    now: () => state.now,
    advance: (seconds: number) => void (state.now = new Date(state.now.getTime() + seconds * 1000)),
  };
};

describe('createScheduler', () => {
  it('sweeps at once, then every interval, never sooner', async () => {
    const time = clock('2026-10-15T03:00:00Z');
    const run = vi.fn(async () => undefined);
    const scheduler = createScheduler(run, { now: time.now, sweepEverySeconds: 300 });

    await scheduler.tick();
    time.advance(60);
    await scheduler.tick();
    time.advance(240);
    await scheduler.tick();

    expect(run.mock.calls.map(([cron]) => cron)).toEqual([SWEEPER_CRON, SWEEPER_CRON]);
  });

  it('runs the daily import once per UTC day, from 04:00', async () => {
    const time = clock('2026-10-15T03:59:00Z');
    const run = vi.fn(async () => undefined);
    const scheduler = createScheduler(run, { now: time.now, sweepEverySeconds: 100_000 });

    await scheduler.tick();
    expect(run.mock.calls.map(([cron]) => cron)).toEqual([SWEEPER_CRON]);

    time.advance(120);
    await scheduler.tick();
    await scheduler.tick();
    expect(run.mock.calls.map(([cron]) => cron)).toEqual([SWEEPER_CRON, DAILY_IMPORT_CRON]);

    time.advance(24 * 3600);
    await scheduler.tick();
    expect(run.mock.calls.filter(([cron]) => cron === DAILY_IMPORT_CRON)).toHaveLength(2);
  });

  it('catches the daily import up when it starts after 04:00; the import guards its own date', async () => {
    const time = clock('2026-10-15T10:00:00Z');
    const run = vi.fn(async () => undefined);
    const scheduler = createScheduler(run, { now: time.now });

    await scheduler.tick();

    expect(run.mock.calls.map(([cron]) => cron)).toEqual([SWEEPER_CRON, DAILY_IMPORT_CRON]);
  });

  it('does not start a run while the same one is still going', async () => {
    const time = clock('2026-10-15T03:00:00Z');
    let release: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((resolve) => void (release = resolve)));
    const scheduler = createScheduler(run, { now: time.now, sweepEverySeconds: 30 });

    const first = scheduler.tick();
    time.advance(60);
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);

    release();
    await first;
  });
});
