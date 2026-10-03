import { withSentry } from '@sentry/cloudflare';
import { sentryOptions } from '../../src/lib/observability/privacy.ts';
// The Worker's entry after `bun run build`: SvelteKit's own Worker (renamed `_sveltekit.js`) plus the
// Cron Trigger's `scheduled` handler, which the adapter does not export. `scripts/wrap-worker.ts`
// copies this file over `.svelte-kit/cloudflare/_worker.js`, so the paths are relative to there.
// wrangler bundles the imports, TypeScript included.
import sveltekit from './_sveltekit.js';
import { handlersFor } from '../../src/lib/server/events/handlers.ts';
import { runSweeper } from '../../src/lib/server/events/sweeper.ts';
import { logger } from '../../src/lib/server/logger.ts';

const cron = withSentry(() => sentryOptions, {
  // Retries domain events that did not finish. See sweepEvents and the cron in wrangler.jsonc.
  async scheduled(_controller, env, _ctx) {
    const log = logger.child({
      requestId: crypto.randomUUID(),
      environment: 'production',
      release: env.CF_VERSION_METADATA?.id,
    });
    await runSweeper(env, { handlers: handlersFor(env), log }).catch((error) =>
      log.error('event sweep failed', { error }),
    );
  },
});

export default { fetch: sveltekit.fetch, scheduled: cron.scheduled };
