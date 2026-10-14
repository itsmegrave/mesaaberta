import {
  AlreadyRegistered,
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableFull,
} from '@mesaaberta/core/server/errors';
import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { FlagName } from '@mesaaberta/core/server/flags/registry';
import { callApiRaw } from './api-client';

/** The refusal an api answer stands for, as the domain error `failFrom` already knows. */
function refusalOf(status: number, body: Record<string, unknown>): Error | null {
  if (status === 400 && body.error === 'invalid')
    return new Invalid(
      typeof body.field === 'string' ? body.field : '',
      typeof body.message === 'string' ? body.message : 'invalid',
    );
  if (status === 403 && body.error === 'forbidden') return new Forbidden();
  if (status === 404 && body.error === 'not_found') return new NotFound();
  if (status === 409 && body.error === 'table_full') return new TableFull();
  if (status === 409 && body.error === 'already_registered') return new AlreadyRegistered();
  if (status === 429 && body.error === 'rate_limited')
    return new RateLimited(typeof body.retryAfter === 'number' ? body.retryAfter : 60);
  return null;
}

/**
 * Makes a signed-in player's write in the api Worker when `flag` is on for them (targeted by id and
 * by `isAdmin`, so a rollout can start with admins). Resolves to the
 * events to dispatch, throws the refusal the api made (so the form shows it as it always did), and
 * resolves to null when the flag is off or the call cannot be used: the caller then runs the
 * service in this Worker, so the flag is a kill switch and not a dependency.
 */
export async function writeViaApi(
  locals: App.Locals,
  flag: FlagName,
  player: Actor,
  path: string,
  body: Record<string, unknown>,
): Promise<{ eventIds: string[]; body: Record<string, unknown> } | null> {
  if (
    !(await locals.flags.isEnabled(flag, { id: player.id, isAdmin: can(player, 'admin:access') }))
  )
    return null;
  const answer = await callApiRaw(locals.env, path, player.id, locals.log, body);
  if (!answer) return null;
  const json = (answer.body ?? {}) as Record<string, unknown>;
  if (
    answer.ok &&
    Array.isArray(json.eventIds) &&
    json.eventIds.every((id) => typeof id === 'string')
  )
    return { eventIds: json.eventIds as string[], body: json };
  const refusal = refusalOf(answer.status, json);
  if (refusal) throw refusal;
  locals.log.warn('api write not used', { code: 'api_call_refused', path, status: answer.status });
  return null;
}
