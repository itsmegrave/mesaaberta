import * as Sentry from '@sentry/cloudflare';
import { sentryOptionsForApp } from '@mesaaberta/core/observability/sentry-options';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createWorker, type WorkerEnv } from './index';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the worker wrapped with Sentry. Kept apart from index.ts so the handler
// itself stays testable without the SDK. Same privacy policy as the web app; without SENTRY_DSN
// the SDK stays off and the logger still writes to the console.
setTelemetrySink(sentrySink);
setAppName('worker');

export default Sentry.withSentry(
  (env: WorkerEnv) => ({
    ...sentryOptionsForApp('worker'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    release: env.CF_VERSION_METADATA?.id,
  }),
  createWorker(),
);
