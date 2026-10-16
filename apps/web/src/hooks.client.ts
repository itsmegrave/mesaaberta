import * as Sentry from '@sentry/sveltekit';
import { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN } from '$app/env/public';
import { sentryOptionsFor } from '#lib/observability/privacy.js';

Sentry.init(
  sentryOptionsFor(
    { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN },
    location.origin,
    import.meta.env.PROD,
  ),
);
export const handleError = Sentry.handleErrorWithSentry();
