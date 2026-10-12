import type { Handle } from '@sveltejs/kit';
import type { PayloadCache } from '$lib/server/flags/payload';

/** What the host offers beyond variables. Every member is optional: plain `vite dev` has none. */
export type Host = {
  /** Keeps the request alive until `promise` settles, without holding up the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** A small string store with a time to live, shared between requests. */
  cache?: PayloadCache;
};

// Adapts the Workers Cache API to the string store the flags loader expects.
type WorkersCache = App.Platform['caches']['default'];

const workersCache = (cache: WorkersCache): PayloadCache => ({
  get: async (url) => (await cache.match(url))?.text(),
  set: (url, body, ttlSeconds) =>
    cache.put(
      url,
      // The DOM lib and the generated Workers types both declare `Response`. It is the same
      // class in the Workers runtime; only the two type declarations disagree.
      new Response(body, {
        headers: { 'cache-control': `max-age=${ttlSeconds}` },
      }) as unknown as Parameters<WorkersCache['put']>[1],
    ),
});

/**
 * Exposes `locals.env` (the variables and bindings the host gave this request) and `locals.host`
 * (what else it offers). This is the one module that reads them from the host (today Cloudflare's
 * `platform`); everything else reads `locals`, so another host only has to fill them here. A lint
 * rule keeps it that way.
 */
export const handleRuntime: Handle = ({ event, resolve }) => {
  const { env, ctx, caches } = event.platform ?? {};
  event.locals.env = env;
  event.locals.host = {
    waitUntil: ctx && ((promise) => ctx.waitUntil(promise)),
    cache: caches && workersCache(caches.default),
  };
  return resolve(event);
};
