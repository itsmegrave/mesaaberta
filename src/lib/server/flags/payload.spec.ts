import { describe, expect, it, vi } from 'vitest';
import { growthBookPayload, type PayloadCache } from './payload';

const apiHost = 'https://cdn.growthbook.io';
const clientKey = 'sdk-test';
const body = { status: 200, features: { tables_open: { defaultValue: true } } };

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const memoryCache = (): PayloadCache => {
	const store = new Map<string, string>();
	return {
		get: async (url) => store.get(url),
		set: async (url, body) => void store.set(url, body)
	};
};

const setup = (fetch: typeof globalThis.fetch, cache?: PayloadCache) => {
	const pending: Promise<unknown>[] = [];
	const load = growthBookPayload({
		apiHost,
		clientKey,
		fetch,
		cache,
		waitUntil: (promise) => void pending.push(promise),
		timeoutMs: 50
	});
	return { load, settled: () => Promise.all(pending) };
};

describe('growthBookPayload', () => {
	it('requests the feature payload for the client key and returns it', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () => json(body));

		const payload = await setup(fetch).load();

		expect(fetch.mock.calls[0][0]).toBe('https://cdn.growthbook.io/api/features/sdk-test');
		expect(payload).toEqual(body);
	});

	it.each([
		['the request rejects', async () => Promise.reject(new Error('offline'))],
		['the server answers with an error status', async () => json({ error: 'nope' }, 503)],
		['the body is not JSON', async () => new Response('<html>oops</html>')],
		[
			'the request times out',
			(_url: unknown, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) =>
					init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
				)
		]
	])('returns null instead of throwing when %s', async (_name, respond) => {
		const payload = await setup(respond as typeof globalThis.fetch).load();

		expect(payload).toBeNull();
	});

	it('serves a cached payload without asking GrowthBook again', async () => {
		const cache = memoryCache();
		const fetch = vi.fn<typeof globalThis.fetch>(async () => json(body));
		const first = setup(fetch, cache);
		await first.load();
		await first.settled();

		const second = await setup(fetch, cache).load();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(second).toEqual(body);
	});

	it('does not cache a failure', async () => {
		const cache = memoryCache();
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(json({}, 500))
			.mockResolvedValueOnce(json(body));
		const first = setup(fetch, cache);
		await first.load();
		await first.settled();

		const second = await setup(fetch, cache).load();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(second).toEqual(body);
	});
});
