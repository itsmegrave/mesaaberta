import { error } from '@sveltejs/kit';
import {
  AlreadyRated,
  AlreadyRegistered,
  DirectMessagesOff,
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableConcluded,
  TableFull,
  TooEarly,
} from '@mesaaberta/core/server/errors';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { PlaceDuplicate } from '@mesaaberta/core/server/places/service';
import { callApiRaw, routeTemplate } from './api-client';

/** The refusal an api answer stands for, as the domain error `failFrom` already knows. */
export function refusalOf(status: number, body: Record<string, unknown>): Error | null {
  if (status === 400 && body.error === 'invalid' && body.message === 'place_duplicate')
    return new PlaceDuplicate(typeof body.slug === 'string' ? body.slug : null);
  if (status === 400 && body.error === 'invalid')
    return new Invalid(
      typeof body.field === 'string' ? body.field : '',
      typeof body.message === 'string' ? body.message : 'invalid',
    );
  if (status === 403 && body.error === 'table_concluded') return new TableConcluded();
  if (status === 403 && body.error === 'forbidden') return new Forbidden();
  if (status === 404 && body.error === 'not_found') return new NotFound();
  if (status === 409 && body.error === 'table_full') return new TableFull();
  if (status === 409 && body.error === 'already_registered') return new AlreadyRegistered();
  if (status === 409 && body.error === 'too_early') return new TooEarly();
  if (status === 409 && body.error === 'already_rated') return new AlreadyRated();
  if (status === 409 && body.error === 'direct_messages_off') return new DirectMessagesOff();
  if (status === 429 && body.error === 'rate_limited')
    return new RateLimited(typeof body.retryAfter === 'number' ? body.retryAfter : 60);
  return null;
}

/**
 * Makes a signed-in person's write in the api Worker, the only place writes happen. Resolves to the
 * events to dispatch and the api's answer, throws the refusal the api made (so the form shows it as
 * it always did), and answers 503 when the call cannot be made or the api fails.
 */
export async function writeViaApi(
  locals: App.Locals,
  actor: Pick<Actor, 'id'>,
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ eventIds: string[]; body: Record<string, unknown> }> {
  const answer = await callApiRaw(locals.env, path, actor.id, locals.log, body, headers);
  if (!answer) error(503, 'API unavailable');
  const json = (answer.body ?? {}) as Record<string, unknown>;
  if (
    answer.ok &&
    Array.isArray(json.eventIds) &&
    json.eventIds.every((id) => typeof id === 'string')
  )
    return { eventIds: json.eventIds as string[], body: json };
  const refusal = refusalOf(answer.status, json);
  if (refusal) throw refusal;
  locals.log.warn('api write failed', {
    code: 'api_call_failed',
    route: routeTemplate(path),
    status: answer.status,
    reason: typeof json.error === 'string' ? json.error : undefined,
  });
  error(503, 'API unavailable');
}
