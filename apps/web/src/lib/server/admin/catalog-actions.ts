import { fail, type Action, type RequestEvent } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import type { ZodType } from 'zod';
import {
  createSchema,
  entrySchema,
  mergeSchema,
  renameSchema,
} from '@mesaaberta/core/admin/catalog';
import { decideViaApi } from '../api-decide';
import { requireAdmin } from '../admin-access';
import { requireUser } from '../auth/guard';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';

/**
 * One form action of the catalog console: only an admin gets in (the hook 404s everyone else, and
 * this checks again), the form is validated by its schema, and the service authorizes the actor a
 * third time. The api Worker makes the decision (`/v1/admin/catalog/<name>`, same schema): what it
 * refuses goes back on the field it names, or on the form.
 */
function catalogAction(name: string, schema: ZodType): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);

    const form = validateStringForm(await request.formData(), schema, [
      'kind',
      'id',
      'name',
      'into',
    ]);
    if (!form.valid) return fail(400, { form });

    const refuse = (field: string, message: string) => {
      // A field the form does not show (the id) is an error of the form itself.
      const name = field in (form.data as object) ? field : '';
      form.valid = false;
      form.errors[name || '_errors'] = [message];
      return fail(400, { form });
    };

    const user = await locals.getUser();
    const decided = await decideViaApi(locals, `/v1/admin/catalog/${name}`, user!.id, form.data);
    if (decided.kind === 'refused') return refuse(decided.field, decided.code);

    // The record is written with the change; the dispatch (no handler yet, it marks it done) comes after.
    const dispatched = decided.eventIds[0];
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.locals.env), dispatched, new Date(), locals.log),
    );
    return { form };
  };
}

/** The console's actions, for the queue and the catalog pages to share. */
export const catalogActions = {
  approve: catalogAction('approve', entrySchema),
  reject: catalogAction('reject', entrySchema),
  disable: catalogAction('disable', entrySchema),
  rename: catalogAction('rename', renameSchema),
  merge: catalogAction('merge', mergeSchema),
  create: catalogAction('create', createSchema),
};
