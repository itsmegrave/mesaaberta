import { env, waitUntil } from 'cloudflare:workers';
import * as Sentry from '@sentry/sveltekit';
import type { PayloadCache } from '@mesaaberta/core/server/flags/payload';
import type { HostBindings } from './types';

// The Workers Cache API as the string store the flags loader expects. `caches` is a global on
// Workers; its `default` cache is not in the DOM types.
type WorkersCache = {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
};

const workersCache = (): PayloadCache => {
  const cache = (caches as unknown as { default: WorkersCache }).default;
  return {
    get: async (url) => (await cache.match(url))?.text(),
    set: (url, body, ttlSeconds) =>
      cache.put(url, new Response(body, { headers: { 'cache-control': `max-age=${ttlSeconds}` } })),
  };
};

/** Cloudflare Workers (SvelteKit 3's adapter reads the bindings from `cloudflare:workers`). */
export const host: HostBindings = {
  name: 'cloudflare',
  env: () => env as App.Locals['env'],
  waitUntil: (promise) => waitUntil(promise),
  cache: workersCache,
  // On Workers the SDK must be set up per request, around everything else.
  telemetry: (options) => Sentry.initCloudflareSentryHandle(options as never),
};
