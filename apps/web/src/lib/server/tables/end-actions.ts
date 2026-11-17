import { redirect, type Action } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { requireApiWrite } from '../api-required';
import { failFrom } from '../fail-from';
import { routes } from '@mesaaberta/core/routes';

/** Native form adapter only; the API owns authorization, locking and deletion/cancellation. */
function endAction(kind: 'draft' | 'close'): Action {
  return async ({ locals, url, params }) => {
    await requireUser(locals, url);
    const actor = (await locals.getProfile())!;
    try {
      await requireApiWrite(
        locals,
        actor,
        `/v1/tables/${encodeURIComponent(params.slug!)}/${kind}`,
        {},
        kind === 'draft' ? 'DELETE' : 'POST',
      );
    } catch (cause) {
      return failFrom(cause);
    }
    redirect(303, routes.myTables);
  };
}

export const endActions = { deleteDraft: endAction('draft'), close: endAction('close') };
