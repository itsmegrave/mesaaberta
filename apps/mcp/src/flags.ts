import { createFlags, type Flags } from '@mesaaberta/core/server/flags/flags';
import { growthBookPayload, isolateCache } from '@mesaaberta/core/server/flags/payload';

export type FlagsEnv = { GROWTHBOOK_API_HOST?: string; GROWTHBOOK_CLIENT_KEY?: string };

// The payload, kept in this isolate, so a request rarely waits on GrowthBook.
const cache = isolateCache();

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
          cache,
          waitUntil: () => {},
        })
      : async () => null,
  );
}
