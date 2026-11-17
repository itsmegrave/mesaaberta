import type { Handle } from '@sveltejs/kit/hooks';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import type { Fields, Logger } from '@mesaaberta/core/server/logger';
import { coloOf, sentryReleaseFor } from '@mesaaberta/core/observability/sentry-options';
import { withRequestId } from '@mesaaberta/contracts';

/** The record a route parameter names, by the path segment before it (`/t/[slug]`). */
const RESOURCE_TYPES: Record<string, string> = {
  // Item pages keep their letter (`/t/[slug]`, `/m/[id]`, `/p/[id]`).
  t: 'table',
  m: 'conversation',
  p: 'partner',
  // Admin and API route templates retain their existing collection names.
  tables: 'table',
  users: 'user',
  u: 'user',
  reports: 'report',
  messages: 'conversation',
  partners: 'partner',
  crowdfunding: 'crowdfunding',
  // A game system's page, `/s/[slug]`.
  s: 'system',
};

/**
 * What the request acts on, from the route template and its parameters: the last parameter whose
 * segment names a resource. `/t/[slug]/edit` is the table `slug`; `/api/query/[resource]` is
 * none, since its parameter is not a record.
 */
export function resourceOf(
  routeId: string | null | undefined,
  params: Partial<Record<string, string>> = {},
): { resourceType?: string; resourceId?: string } {
  const segments = (routeId ?? '').split('/');
  let found: { resourceType?: string; resourceId?: string } = {};
  segments.forEach((segment, i) => {
    const name = /^\[([a-zA-Z]+)(?:=[a-zA-Z]+)?\]$/.exec(segment)?.[1];
    const resourceType = RESOURCE_TYPES[segments[i - 1]];
    const resourceId = name ? params[name] : undefined;
    if (resourceType && resourceId) found = { resourceType, resourceId };
  });
  return found;
}

/**
 * Gives each request a logger bound to its request id and writes one summary line when it ends.
 * The id is Cloudflare's `cf-ray`, so a line can be matched to the edge's own logs; outside
 * Cloudflare (`vite dev`) there is no such header and a random id stands in. Every line also says
 * who acted (`userId`, once `handleAuth` has verified the session) and on what (`resourceType`,
 * `resourceId`), so a refusal can be traced to the person and the record.
 */
export const handleRequestLog =
  (logger: Logger): Handle =>
  async ({ event, resolve }) => {
    const requestId = event.request.headers.get('cf-ray') ?? crypto.randomUUID();
    const resource = resourceOf(event.route?.id, event.params);
    // Every line names the route and the release (the tag, as Sentry's issues do; the Worker
    // version id where there is no tag), so a line and an issue of the same deploy match.
    const base = logger.child({
      requestId,
      environment: import.meta.env.PROD ? 'production' : 'development',
      release: sentryReleaseFor('web', event.locals.env).release,
      route: event.route?.id ?? '/unmatched',
      ...resource,
    });
    // The user is known only once a later hook verifies the session: read it at each line.
    const current = () =>
      event.locals.userId ? base.child({ userId: event.locals.userId }) : base;
    const log: Logger = {
      debug: (msg, fields) => current().debug(msg, fields),
      info: (msg, fields) => current().info(msg, fields),
      warn: (msg, fields) => current().warn(msg, fields),
      error: (msg, fields) => current().error(msg, fields),
      child: (bindings: Fields) => current().child(bindings),
    };
    const started = Date.now();
    Sentry.setTag('requestId', requestId);
    Sentry.setTag('route', event.route?.id ?? '/unmatched');
    // The Cloudflare data center that served the request, to split latency by region.
    const colo = coloOf(event.request);
    if (colo) Sentry.setTag('colo', colo);
    if (resource.resourceType) Sentry.setTag('resourceType', resource.resourceType);
    if (resource.resourceId) Sentry.setTag('resourceId', resource.resourceId);

    event.locals.log = log;

    let response: Response;
    try {
      // Inside, the logger, the api client and the outbox all read the id from the request context.
      response = await withRequestId(requestId, () => resolve(event));
    } catch (error) {
      if (isRedirect(error) || isHttpError(error)) {
        const status = error.status;
        log[status >= 500 ? 'error' : status >= 400 && status !== 404 ? 'warn' : 'info'](
          'request.completed',
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

    // The route is the template; the record it acted on is `resourceId`, bound above.
    log[
      response.status >= 500
        ? 'error'
        : response.status >= 400 && response.status !== 404
          ? 'warn'
          : 'info'
    ]('request.completed', {
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

/**
 * Tags the request's Sentry scope with the verified user once `getUser` resolves, so an error
 * reported later in the request names who hit it. Runs right after `handleAuth`.
 */
export const handleUserTag: Handle = ({ event, resolve }) => {
  const getUser = event.locals.getUser;
  if (getUser) {
    event.locals.getUser = async () => {
      const user = await getUser();
      if (user) Sentry.setTag('userId', user.id);
      return user;
    };
  }
  return resolve(event);
};
