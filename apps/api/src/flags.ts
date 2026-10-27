import type { Context } from 'hono';
import { createFlags, type Flags } from '@mesaaberta/core/server/flags/flags';
import { growthBookPayload, type PayloadCache } from '@mesaaberta/core/server/flags/payload';
import { extensionFlagDefaults } from '@mesaaberta/core/server/extensions/index';

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
 * The GrowthBook flags as the api reads them (Grave, 2026-10-27: the api checks the flags of the
 * work it runs), with the installed extensions' own flags. Without the settings, as locally and in
 * the tests, every flag returns its default.
 */
export function apiFlags(env: FlagsEnv | undefined): Flags {
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
    { extensionFlags: extensionFlagDefaults() },
  );
}

/**
 * Runs work after the answer: on Cloudflare for as long as the request's context lives; on Bun,
 * where there is no such context, the process simply carries on. A failure is the task's to log.
 */
export function afterAnswer(c: Context, task: Promise<unknown>) {
  const settled = task.catch(() => undefined);
  try {
    c.executionCtx.waitUntil(settled);
  } catch {
    void settled;
  }
}
