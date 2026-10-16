import type { Handle } from '@sveltejs/kit/hooks';
import type { PayloadCache } from '@mesaaberta/core/server/flags/payload';

/**
 * What a host (Cloudflare Workers, a Bun server) gives the web app: its variables, a way to keep a
 * request alive past the response, a shared string cache, and the way error reporting is set up
 * around a request. `#host` resolves to one implementation at build time (`HOST`, see
 * `host.config.ts`); `runtime.ts` is the only module that uses it.
 */
export type HostBindings = {
  /** The variables and bindings, or undefined when the host has none. */
  env: () => App.Locals['env'];
  /** Keeps the request alive until the promise settles, without holding up the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** A small string store with a time to live, shared between requests. */
  cache?: () => PayloadCache | undefined;
  /** Sets error reporting up around a request, the way this host needs it. */
  telemetry: (options: Record<string, unknown>) => Handle;
};
