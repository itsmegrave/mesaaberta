// The Worker's entry after `pnpm build`: SvelteKit's own Worker (renamed `_sveltekit.js`) plus the
// Cron Trigger's `scheduled` handler, which the adapter does not export. `scripts/wrap-worker.ts`
// copies this file over `.svelte-kit/cloudflare/_worker.js`, so the paths are relative to there.
// wrangler bundles the imports, TypeScript included.
import sveltekit from './_sveltekit.js';
import { handlersFor } from '../../src/lib/server/events/handlers.ts';
import { runSweeper } from '../../src/lib/server/events/sweeper.ts';
import { logger } from '../../src/lib/server/logger.ts';

export default {
	fetch: sveltekit.fetch,

	// Retries domain events that did not finish. See sweepEvents and the cron in wrangler.jsonc.
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(
			runSweeper(env, { handlers: handlersFor(env), log: logger }).catch((error) =>
				logger.error('event sweep failed', { error })
			)
		);
	}
};
