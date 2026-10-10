import * as Sentry from '@sentry/sveltekit';
import type { TelemetrySink } from './logger';

/** The web app's telemetry sink: structured lines become Sentry logs, handled errors issues. */
export const sentrySink: TelemetrySink = {
  log: (level, msg, fields) => Sentry.logger[level](msg, fields),
  capture: (error, tags) =>
    Sentry.withScope((scope) => {
      scope.setTags(tags as Record<string, string | number | boolean | null | undefined>);
      Sentry.captureException(error);
    }),
};
