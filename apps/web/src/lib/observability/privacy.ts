import { sentryOptionsForApp } from '@mesaaberta/core/observability/sentry-options';

// The vendor-neutral helpers and the privacy policy live in @mesaaberta/core; this file adds what
// this deployment configured and keeps the old import path working.
export * from '@mesaaberta/core/observability/privacy';
export { privateEvent, privateLog } from '@mesaaberta/core/observability/sentry-options';

type SentryEnv = { PUBLIC_SENTRY_DSN?: string; PUBLIC_SENTRY_ORIGIN?: string };

/**
 * Sentry's settings for the web app, server and browser alike. The DSN is public by design (the
 * browser SDK ships it), so it comes from `$app/env/public` (declared in `src/env.ts`). Nothing is sent without a DSN,
 * outside a production build, or from an origin other than `PUBLIC_SENTRY_ORIGIN` when that is set
 * (preview URLs and local builds stay quiet).
 */
export const sentryOptionsFor = (env: SentryEnv, origin: string, production: boolean) => ({
  dsn: env.PUBLIC_SENTRY_DSN || undefined,
  environment: 'production',
  ...sentryOptionsForApp('web'),
  enabled:
    production &&
    !!env.PUBLIC_SENTRY_DSN &&
    (!env.PUBLIC_SENTRY_ORIGIN || env.PUBLIC_SENTRY_ORIGIN === origin),
});
