import * as Sentry from '@sentry/cloudflare';
import { privateSentryOptions } from '@mesaaberta/core/observability/sentry-options';
import { setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createApi } from './app';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the api wrapped with Sentry, with the same privacy policy as the web app and
// the background worker. Without `SENTRY_DSN` the SDK stays off and the logger still writes to the
// console (Workers Logs). Handled errors reach Sentry through the logger (see `onError` in app.ts).
setTelemetrySink(sentrySink);

const api = createApi();

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string; CF_VERSION_METADATA?: { id?: string } }) => ({
    ...privateSentryOptions,
    dsn: env.SENTRY_DSN,
    environment: 'production',
    release: env.CF_VERSION_METADATA?.id,
  }),
  { fetch: api.fetch },
);
