import { privateSentryOptions } from '@mesaaberta/core/observability/sentry-options';

// The vendor-neutral helpers and the privacy policy live in @mesaaberta/core; this file adds this
// deployment's DSN and keeps the old import path working.
export * from '@mesaaberta/core/observability/privacy';
export { privateEvent, privateLog } from '@mesaaberta/core/observability/sentry-options';

export const sentryOptions = {
  dsn: 'https://b1de43dab20b6ee298e5b5725ee38262@o4512176851714048.ingest.us.sentry.io/4512176861937664',
  environment: 'production',
  ...privateSentryOptions,
};
