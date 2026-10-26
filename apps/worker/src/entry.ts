import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestContextStore } from '@mesaaberta/contracts';
import * as Sentry from '@sentry/cloudflare';
import {
  sentryOptionsForApp,
  sentryReleaseFor,
} from '@mesaaberta/core/observability/sentry-options';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createWorker, type WorkerEnv } from './index';
import { checkInMonitor } from './sentry-monitor';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the worker wrapped with Sentry. Kept apart from index.ts so the handler
// itself stays testable without the SDK. Same privacy policy as the web app; without SENTRY_DSN
// the SDK stays off and the logger still writes to the console.
setTelemetrySink(sentrySink);
setAppName('worker');
// Carries the request id to every log line and outbox write of a run (Trello #278).
setRequestContextStore(new AsyncLocalStorage());
logInstalled();

export default Sentry.withSentry(
  (env: WorkerEnv) => ({
    ...sentryOptionsForApp('worker'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    ...sentryReleaseFor('worker', env),
    // Puts the flags the run read (`recordFlag`) on its issues.
    integrations: [Sentry.featureFlagsIntegration()],
  }),
  createWorker(undefined, undefined, checkInMonitor(Sentry)),
);
