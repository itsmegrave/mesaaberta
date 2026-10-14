import * as Sentry from '@sentry/cloudflare';
import type { TelemetrySink } from '@mesaaberta/core/server/logger';

/** The api's telemetry sink, the twin of the background worker's: logs and handled errors. */
export const sentrySink: TelemetrySink = {
  log: (level, msg, fields) => Sentry.logger[level](msg, fields),
  capture: (error, tags) =>
    Sentry.withScope((scope) => {
      scope.setTags(tags as Record<string, string | number | boolean | null | undefined>);
      Sentry.captureException(error);
    }),
};
