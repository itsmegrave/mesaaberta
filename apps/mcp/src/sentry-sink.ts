import * as Sentry from '@sentry/cloudflare';
import type { FeatureFlagsIntegration } from '@sentry/core';
import type { TelemetrySink } from '@mesaaberta/core/server/logger';

/** The MCP server's telemetry sink, the twin of the api's: logs, handled errors and flags. */
export const sentrySink: TelemetrySink = {
  log: (level, msg, fields) => Sentry.logger[level](msg, fields),
  capture: (error, tags) =>
    Sentry.withScope((scope) => {
      scope.setTags(tags as Record<string, string | number | boolean | null | undefined>);
      Sentry.captureException(error);
    }),
  flag: (name, enabled) =>
    Sentry.getClient()
      ?.getIntegrationByName<FeatureFlagsIntegration>('FeatureFlags')
      ?.addFeatureFlag(name, enabled),
};
