import * as Sentry from '@sentry/cloudflare';
import type { TelemetrySink } from '@mesaaberta/core/server/logger';

/** The worker's telemetry sink, the Cloudflare SDK twin of the web app's: logs and handled errors. */
export const sentrySink: TelemetrySink = {
  log: (level, msg, fields) => Sentry.logger[level](msg, fields),
  capture: (error, tags) =>
    Sentry.withScope((scope) => {
      scope.setTags(tags as Record<string, string | number | boolean | null | undefined>);
      Sentry.captureException(error);
    }),
};
