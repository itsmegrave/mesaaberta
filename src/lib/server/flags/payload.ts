import type { FeatureApiResponse } from '@growthbook/growthbook';

/** A tiny string store with a time to live. Deliberately free of Request/Response types. */
export type PayloadCache = {
	get(url: string): Promise<string | undefined>;
	set(url: string, body: string, ttlSeconds: number): Promise<void>;
};

type Options = {
	apiHost: string;
	clientKey: string;
	fetch: typeof globalThis.fetch;
	cache?: PayloadCache;
	waitUntil: (promise: Promise<unknown>) => void;
	ttlSeconds?: number;
	timeoutMs?: number;
};

/**
 * Loads the GrowthBook feature payload, cached briefly so a request rarely waits on the network.
 * Never throws: on any failure it resolves to `null` and callers use their defaults. Failures are
 * not cached, so the next request tries again.
 */
export function growthBookPayload({
	apiHost,
	clientKey,
	fetch,
	cache,
	waitUntil,
	ttlSeconds = 60,
	timeoutMs = 800
}: Options): () => Promise<FeatureApiResponse | null> {
	const url = `${apiHost}/api/features/${clientKey}`;

	return async () => {
		try {
			const cached = await cache?.get(url);
			if (cached) return JSON.parse(cached) as FeatureApiResponse;

			const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
			if (!response.ok) throw new Error(`GrowthBook answered ${response.status}`);
			const payload = (await response.json()) as FeatureApiResponse;

			if (cache) waitUntil(cache.set(url, JSON.stringify(payload), ttlSeconds));
			return payload;
		} catch (error) {
			console.error('flags: could not load GrowthBook features:', String(error));
			return null;
		}
	};
}
