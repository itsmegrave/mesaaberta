import type { Handle } from '@sveltejs/kit/hooks';
import { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN } from '$app/env/public';
import { host as hostBindings } from '#host';
import { sentryOptionsFor } from '#lib/observability/privacy.js';
import {
  sentryReleaseFor,
  type ReleaseEnv,
} from '@mesaaberta/core/observability/sentry-options';
import type { PayloadCache } from '@mesaaberta/core/server/flags/payload';
import type { HostBindings } from './host/types';
import { createHandleServerTiming } from './server-timing';

/** What the host offers beyond variables. Every member is optional: plain `vite dev` has none. */
export type Host = {
  /** Keeps the request alive until `promise` settles, without holding up the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** A small string store with a time to live, shared between requests. */
  cache?: PayloadCache;
};

/**
 * Exposes `locals.env` (the variables and bindings the host gave this request) and `locals.host`
 * (what else it offers). This is the one module that reads them from the host (`#host`, chosen at
 * build time: Cloudflare Workers or a Bun server); everything else reads `locals`, so another host
 * only has to fill them here. A lint rule keeps it that way.
 */
export const createHandleRuntime =
  (bindings: HostBindings): Handle =>
  ({ event, resolve }) => {
    event.locals.env = bindings.env();
    event.locals.host = { waitUntil: bindings.waitUntil, cache: bindings.cache?.() };
    return resolve(event);
  };

export const handleRuntime = createHandleRuntime(hostBindings);

/** Which host this build runs on. */
export const backend = hostBindings.name;

/** `x-backend` and `Server-Timing` for this host, around everything else. */
export const handleServerTiming = createHandleServerTiming(backend);

/**
 * Starts error reporting for the request the way this host needs it. On Workers the SDK must be
 * set up per request, around everything else, so this goes first in the hooks. Another host swaps
 * the `telemetry` of its `#host`; `Sentry.sentryHandle()` and the rest of the hooks stay as they are.
 */
export const handleHostTelemetry: Handle = (input) =>
  hostBindings.telemetry({
    ...sentryOptionsFor(
      { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ORIGIN },
      input.event.url.origin,
      import.meta.env.PROD,
    ),
    ...sentryReleaseFor('web', hostBindings.env() as ReleaseEnv | undefined),
  })(input);
