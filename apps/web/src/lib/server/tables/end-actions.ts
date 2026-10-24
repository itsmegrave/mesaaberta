import { redirect, type Action } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { requireApiWrite } from '../api-required';
import { failFrom } from '../fail-from';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { routes } from '@mesaaberta/core/routes';

/** Native form adapter only; the API owns authorization, locking and deletion/cancellation. */
function endAction(kind: 'draft' | 'close'): Action {
  return async ({ locals, url, params }) => {
    await requireUser(locals, url);
    const actor = (await locals.getProfile())!;
    try {
      const { eventIds } = await requireApiWrite(
        locals,
        actor,
        `/v1/tables/${encodeURIComponent(params.slug!)}/${kind}`,
        {},
        kind === 'draft' ? 'DELETE' : 'POST',
      );
      for (const eventId of eventIds)
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(locals.env), eventId, new Date(), locals.log),
        );
    } catch (cause) {
      return failFrom(cause);
    }
    redirect(303, routes.myTables);
  };
}

export const endActions = { deleteDraft: endAction('draft'), close: endAction('close') };
