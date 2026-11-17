import { Invalid } from '@mesaaberta/core/server/errors';
import { requireApi } from '../api-required';

/**
 * Runs one of an extension's admin hand actions in the api Worker, as this admin: its answer
 * (without `eventIds`), or `{ invalid: true }` for data the action's schema refuses. A 404 for an
 * extension or action nobody installed, a 503 when the api cannot answer.
 */
export async function extensionAction(
  locals: App.Locals,
  extensionId: string,
  adminId: string,
  action: string,
  data: Record<string, string>,
): Promise<{ invalid: true } | Record<string, unknown>> {
  try {
    const { eventIds: _eventIds, ...answer } = await requireApi<Record<string, unknown>>(
      locals,
      { id: adminId },
      `/v1/admin/${encodeURIComponent(extensionId)}/${encodeURIComponent(action)}`,
      { method: 'POST', body: data },
    );
    return answer;
  } catch (cause) {
    if (cause instanceof Invalid) return { invalid: true };
    throw cause;
  }
}
