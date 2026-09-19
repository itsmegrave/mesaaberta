import type { Handle } from '@sveltejs/kit';
import type { Logger } from './logger';

/**
 * Gives each request a logger bound to its request id and writes one summary line when it ends.
 * The id is Cloudflare's `cf-ray`, so a line can be matched to the edge's own logs; outside
 * Cloudflare (`vite dev`) there is no such header and a random id stands in.
 */
export const handleRequestLog =
	(logger: Logger): Handle =>
	async ({ event, resolve }) => {
		const requestId = event.request.headers.get('cf-ray') ?? crypto.randomUUID();
		const log = logger.child({ requestId });
		const started = Date.now();

		event.locals.log = log;

		const response = await resolve(event);

		// Pathname only: the query string is where tokens and emails end up.
		log.info('request', {
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Date.now() - started,
			userId: event.locals.userId
		});

		return response;
	};
