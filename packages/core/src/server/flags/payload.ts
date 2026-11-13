import { logger, type Logger } from '../logger';
import type { FeatureApiResponse } from '@growthbook/growthbook';

/** A tiny string store with a time to live. Deliberately free of Request/Response types. */
export type PayloadCache = {
  get(url: string): Promise<string | undefined>;
  set(url: string, body: string, ttlSeconds: number): Promise<void>;
};

/**
 * A store in this isolate's memory, for Workers without a Cache API to hand (the api, the MCP, the
 * sweeper). Each isolate keeps its own copy; that is enough to spare almost every request the fetch.
 */
export const isolateCache = (): PayloadCache => {
  const kept = new Map<string, { body: string; until: number }>();
  return {
    get: async (url) => {
      const entry = kept.get(url);
      return entry && entry.until > Date.now() ? entry.body : undefined;
    },
    set: async (url, body, ttlSeconds) => {
      kept.set(url, { body, until: Date.now() + ttlSeconds * 1000 });
    },
  };
};

type Options = {
  log?: Pick<Logger, 'warn'>;
  apiHost: string;
  clientKey: string;
  fetch: typeof globalThis.fetch;
  cache?: PayloadCache;
  waitUntil: (promise: Promise<unknown>) => void;
  /** How long a stored payload is used as it is. */
  ttlSeconds?: number;
  /** How long a stored payload may still be served, while a fresh one is fetched behind it. */
  staleSeconds?: number;
  timeoutMs?: number;
};

/** What the cache holds: the payload and when it was fetched. */
type Stored = { fetchedAt: number; payload: FeatureApiResponse };

const read = (body: string): Stored => {
  const parsed = JSON.parse(body) as Partial<Stored> & FeatureApiResponse;
  // A payload stored before the envelope counts as old: served once while a fresh one comes.
  return typeof parsed.fetchedAt === 'number' && parsed.payload
    ? (parsed as Stored)
    : { fetchedAt: 0, payload: parsed };
};

/** Refreshes in flight in this isolate, so a burst of requests on a stale payload fetches once. */
const refreshing = new Set<string>();

/**
 * Loads the GrowthBook feature payload. A stored payload younger than `ttlSeconds` (5 minutes) is
 * used as it is; an older one, up to `staleSeconds` (a day), is still served at once while a fresh
 * one is fetched after the answer (stale-while-revalidate), so a request only waits on GrowthBook
 * when nothing is stored. A flag change reaches every request within about the TTL. Never throws:
 * on any failure it resolves to `null` and callers use their defaults. Failures are not cached.
 */
export function growthBookPayload({
  apiHost,
  clientKey,
  fetch,
  cache,
  waitUntil,
  ttlSeconds = 300,
  staleSeconds = 86_400,
  timeoutMs = 800,
  log = logger,
}: Options): () => Promise<FeatureApiResponse | null> {
  const url = `${apiHost}/api/features/${clientKey}`;

  const fetchPayload = async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok)
      throw Object.assign(new Error(`GrowthBook answered ${response.status}`), {
        code: `HTTP_${response.status}`,
      });
    return (await response.json()) as FeatureApiResponse;
  };
  const store = (payload: FeatureApiResponse) =>
    cache
      ? cache.set(
          url,
          JSON.stringify({ fetchedAt: Date.now(), payload } satisfies Stored),
          staleSeconds,
        )
      : Promise.resolve();

  return async () => {
    try {
      const body = await cache?.get(url).catch(() => undefined);
      if (body) {
        const { fetchedAt, payload } = read(body);
        if (Date.now() - fetchedAt > ttlSeconds * 1000 && !refreshing.has(url)) {
          refreshing.add(url);
          waitUntil(
            fetchPayload()
              .then(store)
              .catch((error) => log.warn('flags.fetch.failed', { error }))
              .finally(() => refreshing.delete(url)),
          );
        }
        return payload;
      }

      const payload = await fetchPayload();
      if (cache) waitUntil(store(payload));
      return payload;
    } catch (error) {
      log.warn('flags.fetch.failed', { error });
      return null;
    }
  };
}
