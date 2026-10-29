import { createFlags, type Flags } from '@mesaaberta/core/server/flags/flags';
import { growthBookPayload, type PayloadCache } from '@mesaaberta/core/server/flags/payload';

export type FlagsEnv = { GROWTHBOOK_API_HOST?: string; GROWTHBOOK_CLIENT_KEY?: string };

// The payload, kept for its time to live in this isolate, so a request rarely waits on GrowthBook.
const kept = new Map<string, { body: string; until: number }>();
const isolateCache: PayloadCache = {
  get: async (url) => {
    const entry = kept.get(url);
    return entry && entry.until > Date.now() ? entry.body : undefined;
  },
  set: async (url, body, ttlSeconds) => {
    kept.set(url, { body, until: Date.now() + ttlSeconds * 1000 });
  },
};

/**
 * The GrowthBook flags as the MCP reads them, like the api's `apiFlags`. Without the settings, as
 * locally and in the tests, every flag returns its default, so `use_mcp` keeps the MCP shut.
 */
export function mcpFlags(env: FlagsEnv | undefined): Flags {
  return createFlags(
    env?.GROWTHBOOK_API_HOST && env.GROWTHBOOK_CLIENT_KEY
      ? growthBookPayload({
          apiHost: env.GROWTHBOOK_API_HOST,
          clientKey: env.GROWTHBOOK_CLIENT_KEY,
          fetch,
          cache: isolateCache,
          waitUntil: () => {},
        })
      : async () => null,
  );
}
