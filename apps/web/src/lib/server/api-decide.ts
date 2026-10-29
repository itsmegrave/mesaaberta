import { error } from '@sveltejs/kit';
import { callApiRaw, routeTemplate } from './api-client';

/** How a decision handed to the api Worker came out. */
export type Decided =
  /** The api made it; these are the events to dispatch after the response. */
  | { kind: 'done'; eventIds: string[] }
  /** The api refused it the way the in-process service would: show `code` on `field`. */
  | { kind: 'refused'; status: 400 | 403 | 404 | 429; field: string; code: string };

type Body = {
  eventId?: unknown;
  eventIds?: unknown;
  error?: unknown;
  field?: unknown;
  message?: unknown;
};

/**
 * Asks the api Worker to make an admin decision; the api is the only place it is made. A refusal
 * comes back as `refused`; a call that cannot be made, or an api that fails, answers 503.
 */
export async function decideViaApi(
  locals: App.Locals,
  path: string,
  actorId: string,
  data: unknown,
): Promise<Decided> {
  const answer = await callApiRaw(locals.env, path, actorId, locals.log, data);
  if (!answer) error(503, 'API unavailable');
  const body = (answer.body ?? {}) as Body;

  if (answer.ok) {
    const ids = Array.isArray(body.eventIds)
      ? body.eventIds
      : typeof body.eventId === 'string'
        ? [body.eventId]
        : null;
    if (ids?.every((id) => typeof id === 'string'))
      return { kind: 'done', eventIds: ids as string[] };
  } else if (
    answer.status === 400 &&
    body.error === 'invalid' &&
    typeof body.message === 'string'
  ) {
    return {
      kind: 'refused',
      status: 400,
      field: typeof body.field === 'string' ? body.field : '',
      code: body.message,
    };
  } else if (answer.status === 429 && body.error === 'rate_limited') {
    return { kind: 'refused', status: 429, field: '', code: 'rate_limited' };
  } else if (answer.status === 403 && body.error === 'forbidden') {
    return { kind: 'refused', status: 403, field: '', code: 'forbidden' };
  } else if (answer.status === 404 && body.error === 'not_found' && path.split('/').length > 4) {
    // Only an entry the service could not find; an unknown decision is a bug.
    return { kind: 'refused', status: 404, field: '', code: 'not_found' };
  }
  locals.log.warn('api.decision_failed', {
    code: 'api_call_failed',
    route: routeTemplate(path),
    status: answer.status,
    reason: typeof body.error === 'string' ? body.error : undefined,
  });
  error(503, 'API unavailable');
}
