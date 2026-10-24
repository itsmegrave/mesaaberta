import { callApiRaw } from '../api-client';

/**
 * Asks the api Worker for one of the admin's Instagram hand actions when `api_admin_instagram` is on
 * for them: its answer, or null when the flag is off or the call cannot be made (the caller then
 * runs the same service here). A refusal the api made is `{ invalid: true }`.
 */
export async function instagramViaApi(
  locals: App.Locals,
  adminId: string,
  action: 'queue' | 'reconcile' | 'connect',
  data: Record<string, string>,
): Promise<{ invalid: true } | Record<string, unknown> | null> {
  if (!(await locals.flags.isEnabled('api_admin_instagram', { id: adminId, isAdmin: true })))
    return null;

  const answer = await callApiRaw(
    locals.env,
    `/v1/admin/instagram/${action}`,
    adminId,
    locals.log,
    data,
  );
  if (!answer) return null;

  const body = (answer.body ?? {}) as Record<string, unknown>;
  if (answer.ok && Array.isArray(body.eventIds)) return body;
  if (answer.status === 400 && body.error === 'invalid') return { invalid: true };

  locals.log.warn('api instagram action not used', {
    code: 'api_call_refused',
    status: answer.status,
    reason: typeof body.error === 'string' ? body.error : undefined,
  });
  return null;
}
