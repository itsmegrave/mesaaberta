import * as Sentry from '@sentry/sveltekit';
import type { FeatureFlagsIntegration } from '@sentry/core';
import type { TelemetrySink } from '@mesaaberta/core/server/logger';

/**
 * The web app's telemetry sink: structured lines become Sentry logs, handled errors issues, and the
 * flags a request read go on its issues.
 */
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
