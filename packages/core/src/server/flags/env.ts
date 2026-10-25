import { createFlags, type Flags } from './flags';
import { growthBookPayload } from './payload';

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
          waitUntil: () => {},
        })
      : async () => null,
    { extensionFlags },
  );
}
