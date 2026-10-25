import * as Sentry from '@sentry/cloudflare';
import { sentryOptionsForApp } from '@mesaaberta/core/observability/sentry-options';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createApi } from './app';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the api wrapped with Sentry, with the same privacy policy as the web app and
// the background worker. Without `SENTRY_DSN` the SDK stays off and the logger still writes to the
// console (Workers Logs). Handled errors reach Sentry through the logger (see `onError` in app.ts).
setTelemetrySink(sentrySink);
setAppName('api');
logInstalled();

const api = createApi();

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string; CF_VERSION_METADATA?: { id?: string } }) => ({
    ...sentryOptionsForApp('api'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    release: env.CF_VERSION_METADATA?.id,
  }),
  { fetch: api.fetch },
);
