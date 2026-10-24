import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { FlagName } from '@mesaaberta/core/server/flags/registry';
import { callApiRaw, routeTemplate } from './api-client';

/**
 * Reads a page's data from the api Worker when `flag` is on for the signed-in person (targeted by
 * id and `isAdmin`, so a rollout can start with admins). Resolves to the JSON the api answered, or
 * to null when the flag is off or the call cannot be used (no binding, a refusal, a failure): the
 * caller then runs the same reader in this Worker, so the flag is a kill switch and not a
 * dependency. The api takes the subject from the actor header, never from the path.
 */
export async function readViaApi<T>(
  locals: App.Locals,
  flag: FlagName,
  viewer: Actor,
  path: string,
): Promise<T | null> {
  if (
    !(await locals.flags.isEnabled(flag, { id: viewer.id, isAdmin: can(viewer, 'admin:access') }))
  )
    return null;

  const answer = await callApiRaw(locals.env, path, viewer.id, locals.log, undefined, {}, 'GET');
  if (!answer) return null;
  if (!answer.ok) {
    locals.log.warn('api read not used', {
      code: 'api_call_refused',
      route: routeTemplate(path),
      status: answer.status,
    });
    return null;
  }
  return answer.body as T;
}
