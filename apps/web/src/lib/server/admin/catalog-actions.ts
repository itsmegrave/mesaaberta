import { error, fail, type Action, type RequestEvent } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import type { z, ZodType } from 'zod';
import {
  createSchema,
  entrySchema,
  mergeSchema,
  renameSchema,
} from '@mesaaberta/core/admin/catalog';
import { decideViaApi } from '../api-decide';
import { requireAdmin } from '../admin-access';
import { requireUser } from '../auth/guard';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { Invalid } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import {
  approveEntry,
  createEntry,
  disableEntry,
  mergeEntry,
  rejectEntry,
  renameEntry,
} from '@mesaaberta/core/server/admin/catalog';

/**
 * One form action of the catalog console: only an admin gets in (the hook 404s everyone else, and
 * this checks again), the form is validated by its schema, and the service authorizes the actor a
 * third time. What the service refuses goes back on the field it names, or on the form.
 *
 * With `api_admin_catalog` on for the admin the decision is made by the api Worker instead
 * (`/v1/admin/catalog/<name>`, same schema, same service). A refusal from the api is shown like one
 * from here; a call that cannot be made, or an api that answers with a failure, falls back to this
 * Worker, which is why the flag is a kill switch and not a dependency.
 */
function catalogAction<Schema extends ZodType>(
  name: string,
  schema: Schema,
  apply: (db: AnyDb, actor: Actor | null, data: z.infer<Schema>) => Promise<string>,
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);
    if (!locals.db) error(503, 'Database not configured');

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

    const profile = await locals.getProfile();
    let eventId: string | undefined;
    if (profile) {
      const viaApi = await decideViaApi(
        locals,
        'api_admin_catalog',
        `/v1/admin/catalog/${name}`,
        profile.id,
        form.data,
      );
      if (viaApi.kind === 'done') eventId = viaApi.eventIds[0];
      else if (viaApi.kind === 'refused') return refuse(viaApi.field, viaApi.code);
    }

    if (eventId === undefined) {
      try {
        eventId = await apply(locals.db, profile, form.data as z.infer<Schema>);
      } catch (e) {
        if (e instanceof Invalid) return refuse(e.field, e.message);
        throw e;
      }
    }

    // The record is written with the change; the dispatch (no handler yet, it marks it done) comes after.
    const dispatched = eventId;
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.locals.env), dispatched, new Date(), locals.log),
    );
    return { form };
  };
}

/** The console's actions, for the queue and the catalog pages to share. */
export const catalogActions = {
  approve: catalogAction('approve', entrySchema, (db, actor, { kind, id }) =>
    approveEntry(db, actor, kind, id),
  ),
  reject: catalogAction('reject', entrySchema, (db, actor, { kind, id }) =>
    rejectEntry(db, actor, kind, id),
  ),
  disable: catalogAction('disable', entrySchema, (db, actor, { kind, id }) =>
    disableEntry(db, actor, kind, id),
  ),
  rename: catalogAction('rename', renameSchema, (db, actor, { kind, id, name }) =>
    renameEntry(db, actor, kind, id, name),
  ),
  merge: catalogAction('merge', mergeSchema, (db, actor, { kind, id, into }) =>
    mergeEntry(db, actor, kind, id, into),
  ),
  create: catalogAction('create', createSchema, (db, actor, { kind, name }) =>
    createEntry(db, actor, kind, name),
  ),
};
