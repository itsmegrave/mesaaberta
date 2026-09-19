import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createFlags } from '$lib/server/flags/flags';
import { growthBookPayload, type PayloadCache } from '$lib/server/flags/payload';
import { logger } from '$lib/server/logger';
import { handleRequestLog } from '$lib/server/request-log';
import { handleSecurityHeaders } from '$lib/server/security-headers';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

// Adapts the Workers Cache API to the string store the flags loader expects.
type WorkersCache = App.Platform['caches']['default'];

const workersCache = (cache: WorkersCache): PayloadCache => ({
	get: async (url) => (await cache.match(url))?.text(),
	set: (url, body, ttlSeconds) =>
		cache.put(
			url,
			// The DOM lib and the generated Workers types both declare `Response`. It is the same
			// class in the Workers runtime; only the two type declarations disagree.
			new Response(body, {
				headers: { 'cache-control': `max-age=${ttlSeconds}` }
			}) as unknown as Parameters<WorkersCache['put']>[1]
		)
});

// Flags load lazily: nothing is fetched unless a route reads one. Without the GrowthBook
// settings (for example plain `vite dev`), every flag returns its default.
const handleFlags: Handle = ({ event, resolve }) => {
	const { env, caches, ctx } = event.platform ?? {};

	event.locals.flags = createFlags(
		env?.GROWTHBOOK_CLIENT_KEY
			? growthBookPayload({
					apiHost: env.GROWTHBOOK_API_HOST,
					clientKey: env.GROWTHBOOK_CLIENT_KEY,
					fetch,
					cache: caches && workersCache(caches.default),
					waitUntil: (promise) => ctx?.waitUntil(promise)
				})
			: async () => null
	);

	return resolve(event);
};

// Security headers go first so they wrap every response, including the ones later hooks produce.
export const handle: Handle = sequence(
	handleSecurityHeaders,
	handleRequestLog(logger),
	handleParaglide,
	handleFlags
);

// Replaces SvelteKit's default console output so an unexpected error carries the request id.
// A 404 is a visitor's typo, not a fault, and the request line already records it.
export const handleError: HandleServerError = ({ error, event, status }) => {
	if (status !== 404) (event.locals.log ?? logger).error('unhandled error', { error, status });
};
