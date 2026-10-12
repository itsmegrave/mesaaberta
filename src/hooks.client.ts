import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { sentryOptionsFor } from '$lib/observability/privacy';

Sentry.init(sentryOptionsFor(env, location.origin, import.meta.env.PROD));
export const handleError = Sentry.handleErrorWithSentry();
