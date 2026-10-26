import type { CheckIn, MonitorConfig } from '@sentry/core';
import type { CronMonitor, Monitor } from '@mesaaberta/core/server/events/monitors';

/** The part of the Sentry SDK a monitored run needs; `Sentry` itself in entry.ts. */
export type CheckInClient = {
  captureCheckIn: (checkIn: CheckIn, config?: MonitorConfig) => string;
  flush: (timeout?: number) => PromiseLike<boolean>;
};

/** How long the run waits for its opening check-in to leave before it starts anyway. */
const OPEN_FLUSH_MS = 2000;

/**
 * Wraps one run in check-ins: in progress, then ok or error; Sentry creates or updates the monitor
 * from the config. Unlike `Sentry.withMonitor`, the opening check-in is flushed before the run.
 * The Cloudflare transport only sends on flush, so withMonitor's two check-ins left together at the
 * end of the run, in parallel; when the closing one landed first, Sentry kept the run in progress
 * and later marked it a timeout although it had finished (Sentry MESA-ABERTA-APP-1E).
 */
export const checkInMonitor =
  (sdk: CheckInClient, now: () => number = Date.now): Monitor =>
  async <T>(job: CronMonitor, run: () => Promise<T>) => {
    const checkInId = sdk.captureCheckIn(
      { monitorSlug: job.slug, status: 'in_progress' },
      {
        schedule: { type: 'crontab', value: job.schedule },
        checkinMargin: job.checkinMargin,
        maxRuntime: job.maxRuntime,
        timezone: 'Etc/UTC',
        failureIssueThreshold: 1,
        recoveryThreshold: 1,
      },
    );
    // A slow or failed flush must not hold up the job; the check-in then leaves with the last one.
    await Promise.resolve(sdk.flush(OPEN_FLUSH_MS)).catch(() => false);
    const started = now();
    const close = (status: 'ok' | 'error') =>
      sdk.captureCheckIn({
        monitorSlug: job.slug,
        status,
        checkInId,
        duration: (now() - started) / 1000,
      });
    try {
      const result = await run();
      close('ok');
      return result;
    } catch (error) {
      close('error');
      throw error;
    }
  };
