import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestContextStore } from '@mesaaberta/contracts';
import * as Sentry from '@sentry/cloudflare';
import {
  sentryOptionsForApp,
  sentryReleaseFor,
  type ReleaseEnv,
} from '@mesaaberta/core/observability/sentry-options';
import { setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { createMcp } from './app';
import { sentrySink } from './sentry-sink';

// What wrangler runs: the MCP server wrapped with Sentry, with the same privacy policy as the other
// Workers. Without `SENTRY_DSN` the SDK stays off and the logger still writes to Workers Logs.
setTelemetrySink(sentrySink);
setAppName('mcp');
// Carries the request id to every log line of the request and to the api calls it makes.
setRequestContextStore(new AsyncLocalStorage());

const mcp = createMcp();

export default Sentry.withSentry(
  (env: { SENTRY_DSN?: string } & ReleaseEnv) => ({
    ...sentryOptionsForApp('mcp'),
    dsn: env.SENTRY_DSN,
    environment: 'production',
    ...sentryReleaseFor('mcp', env),
    integrations: [Sentry.featureFlagsIntegration()],
  }),
  { fetch: mcp.fetch },
);
