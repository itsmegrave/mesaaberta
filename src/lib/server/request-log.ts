import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import { isHttpError, isRedirect } from '@sveltejs/kit';
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
    const log = logger.child({
      requestId,
      environment: import.meta.env.PROD ? 'production' : 'development',
      release: event.platform?.env.CF_VERSION_METADATA?.id,
    });
    const started = Date.now();
    Sentry.setTag('requestId', requestId);
    Sentry.setTag('route', event.route?.id ?? '/unmatched');

    event.locals.log = log;

    let response: Response;
    try {
      response = await resolve(event);
    } catch (error) {
      if (isRedirect(error) || isHttpError(error)) {
        const status = error.status;
        log[status >= 500 ? 'error' : status >= 400 && status !== 404 ? 'warn' : 'info'](
          'request',
          {
            event: 'request.completed',
            method: event.request.method,
            route: event.route?.id ?? '/unmatched',
            status,
            outcome: status >= 500 ? 'failed' : status >= 400 ? 'rejected' : 'succeeded',
            durationMs: Date.now() - started,
          },
        );
        throw error;
      }
      log.error('request.failed', {
        event: 'request.failed',
        method: event.request.method,
        route: event.route?.id ?? '/unmatched',
        status: 500,
        durationMs: Date.now() - started,
        error,
      });
      throw error;
    }

    // Route templates keep slugs and other user-controlled path segments out of telemetry.
    log[
      response.status >= 500
        ? 'error'
        : response.status >= 400 && response.status !== 404
          ? 'warn'
          : 'info'
    ]('request', {
      method: event.request.method,
      route: event.route?.id ?? '/unmatched',
      event: 'request.completed',
      outcome:
        response.status >= 500 ? 'failed' : response.status >= 400 ? 'rejected' : 'succeeded',
      status: response.status,
      durationMs: Date.now() - started,
    });

    return response;
  };
