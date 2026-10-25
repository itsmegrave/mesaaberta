import { isFlagName } from '@mesaaberta/core/server/flags/registry';
import { callApiRaw } from '../api-client';

/**
 * Asks the api Worker for one of an extension's admin hand actions when `api_admin_<id>` is on for
 * the admin: its answer, or null when the extension has no such flag, the flag is off or the call
 * cannot be made (the caller then runs the same action here). A refusal the api made is
 * `{ invalid: true }`.
 */
export async function extensionViaApi(
  locals: App.Locals,
  extensionId: string,
  adminId: string,
  action: string,
  data: Record<string, string>,
): Promise<{ invalid: true } | Record<string, unknown> | null> {
  const flag = `api_admin_${extensionId}`;
  if (!isFlagName(flag) || !(await locals.flags.isEnabled(flag, { id: adminId, isAdmin: true })))
    return null;

  const answer = await callApiRaw(
    locals.env,
    `/v1/admin/${extensionId}/${action}`,
    adminId,
    locals.log,
    data,
  );
  if (!answer) return null;

  const body = (answer.body ?? {}) as Record<string, unknown>;
  if (answer.ok && Array.isArray(body.eventIds)) return body;
  if (answer.status === 400 && body.error === 'invalid') return { invalid: true };

  locals.log.warn('api extension action not used', {
    code: 'api_call_refused',
    extension: extensionId,
    status: answer.status,
    reason: typeof body.error === 'string' ? body.error : undefined,
  });
  return null;
}
