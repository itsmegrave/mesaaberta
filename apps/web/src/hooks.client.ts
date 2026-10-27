import * as Sentry from '@sentry/sveltekit';
import { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN } from '$app/env/public';
import { sentryOptionsFor } from '#lib/observability/privacy.js';
import { clientFamilyOf } from '#lib/observability/client-family.js';

Sentry.init(
  sentryOptionsFor(
    { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN },
    location.origin,
    import.meta.env.PROD,
  ),
);
// Browser and OS families only, so Web Vitals can be split by device; the user agent stays here.
const family = clientFamilyOf(navigator.userAgent);
Sentry.setContext('browser', { name: family.browser });
Sentry.setContext('os', { name: family.os });
export const handleError = Sentry.handleErrorWithSentry();
