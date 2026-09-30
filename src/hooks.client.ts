import * as Sentry from '@sentry/sveltekit';
import { sentryOptions } from '$lib/observability/privacy';

Sentry.init({
  ...sentryOptions,
  enabled: import.meta.env.PROD && location.hostname === 'mesaaberta.app',
});
export const handleError = Sentry.handleErrorWithSentry();
