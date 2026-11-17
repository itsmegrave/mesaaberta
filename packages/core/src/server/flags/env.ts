import { createFlags, type Flags } from './flags';
import { growthBookPayload, isolateCache } from './payload';

// Kept in this isolate, so each sweep and each extension publisher doesn't fetch the payload again.
const cache = isolateCache();

type Env = { GROWTHBOOK_API_HOST?: string; GROWTHBOOK_CLIENT_KEY?: string };

/**
 * Flags for code that has no request to take them from (an extension's publisher in the sweeper or
 * the background Worker), read from the same GrowthBook settings the web app uses. Without them
 * every flag returns its default.
 */
export function flagsFromEnv(
  env: Env | undefined,
  extensionFlags: Readonly<Record<string, boolean>>,
): Flags {
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
    { extensionFlags },
  );
}
