import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestContextStore } from '@mesaaberta/contracts';
import * as Sentry from '@sentry/cloudflare';
import {
  sentryOptionsForApp,
  sentryReleaseFor,
} from '@mesaaberta/core/observability/sentry-options';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import type { Monitor } from '@mesaaberta/core/server/events/monitors';
import { createWorker, type WorkerEnv } from './index';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the worker wrapped with Sentry. Kept apart from index.ts so the handler
// itself stays testable without the SDK. Same privacy policy as the web app; without SENTRY_DSN
// the SDK stays off and the logger still writes to the console.
setTelemetrySink(sentrySink);
setAppName('worker');
// Carries the request id to every log line and outbox write of a run (Trello #278).
setRequestContextStore(new AsyncLocalStorage());
logInstalled();

// A check-in in progress, then ok or error; Sentry creates or updates the monitor from this config.
const sentryMonitor: Monitor = (job, run) =>
  Sentry.withMonitor(job.slug, run, {
    schedule: { type: 'crontab', value: job.schedule },
    checkinMargin: job.checkinMargin,
    maxRuntime: job.maxRuntime,
    timezone: 'Etc/UTC',
    failureIssueThreshold: 1,
    recoveryThreshold: 1,
  });

export default Sentry.withSentry(
  (env: WorkerEnv) => ({
    ...sentryOptionsForApp('worker'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    ...sentryReleaseFor('worker', env),
  }),
  createWorker(undefined, undefined, sentryMonitor),
);
