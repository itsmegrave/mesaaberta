import { withSentry } from '@sentry/cloudflare';
import { sentryOptionsFor } from '../../src/lib/observability/privacy.ts';
// The Worker's entry after `bun run build`: SvelteKit's own Worker (renamed `_sveltekit.js`) plus the
// Cron Trigger's `scheduled` handler, which the adapter does not export. `scripts/wrap-worker.ts`
// copies this file over `.svelte-kit/cloudflare/_worker.js`, so the paths are relative to there.
// wrangler bundles the imports, TypeScript included.
import sveltekit from './_sveltekit.js';
import { runScheduled } from '../../src/lib/server/events/scheduled.ts';
import { logger } from '../../src/lib/server/logger.ts';

// The cron has no origin of its own: it reports whenever the deployment configured a DSN.
const cron = withSentry((env) => sentryOptionsFor(env, env.PUBLIC_SENTRY_ORIGIN ?? '', true), {
  // Retries domain events that did not finish. See sweepEvents and the cron in wrangler.jsonc.
  async scheduled(controller, env, _ctx) {
    const log = logger.child({
      requestId: crypto.randomUUID(),
      environment: 'production',
      release: env.CF_VERSION_METADATA?.id,
    });
    await runScheduled(controller, env, { log }).catch((error) =>
      log.error('scheduled job failed', { error }),
    );
  },
});

export default { fetch: sveltekit.fetch, scheduled: cron.scheduled };
