import { DAILY_IMPORT_CRON, SWEEPER_CRON } from './scheduled';

/**
 * The cron monitors of the worker's two jobs (Trello #277): a check-in when a run starts and when
 * it ends, so the error tracker alerts on a failed run, a run that never came (`checkinMargin`
 * minutes late) and one that ran too long (`maxRuntime` minutes). Times are UTC, like the triggers.
 */
export type CronMonitor = {
  slug: string;
  schedule: string;
  checkinMargin: number;
  maxRuntime: number;
};

export const CRON_MONITORS: Record<string, CronMonitor> = {
  [SWEEPER_CRON]: {
    slug: 'worker-event-sweep',
    schedule: SWEEPER_CRON,
    // Five minutes apart: a run two minutes late is already one the next would overlap.
    checkinMargin: 2,
    maxRuntime: 5,
  },
  [DAILY_IMPORT_CRON]: {
    slug: 'worker-daily-import',
    schedule: DAILY_IMPORT_CRON,
    checkinMargin: 15,
    maxRuntime: 30,
  },
};

/** Wraps one run in check-ins; the default runs it as it is, without an error tracker. */
export type Monitor = <T>(monitor: CronMonitor, run: () => Promise<T>) => Promise<T>;

export const unmonitored: Monitor = (_monitor, run) => run();
