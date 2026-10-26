import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestContextStore } from '@mesaaberta/contracts';
import * as Sentry from '@sentry/cloudflare';
import {
  sentryOptionsForApp,
  sentryReleaseFor,
  type ReleaseEnv,
} from '@mesaaberta/core/observability/sentry-options';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createApi } from './app';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the api wrapped with Sentry, with the same privacy policy as the web app and
// the background worker. Without `SENTRY_DSN` the SDK stays off and the logger still writes to the
// console (Workers Logs). Handled errors reach Sentry through the logger (see `onError` in app.ts).
setTelemetrySink(sentrySink);
setAppName('api');
// Carries the request id to every log line and outbox write of the request (Trello #278).
setRequestContextStore(new AsyncLocalStorage());
logInstalled();

const api = createApi();

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string } & ReleaseEnv) => ({
    ...sentryOptionsForApp('api'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    ...sentryReleaseFor('api', env),
  }),
  { fetch: api.fetch },
);
