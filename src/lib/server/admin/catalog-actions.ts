import { error, fail, type Action, type RequestEvent } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z, ZodType } from 'zod';
import { createSchema, entrySchema, mergeSchema, renameSchema } from '$lib/admin/catalog';
import { requireAdmin } from '../admin-access';
import { requireUser } from '../auth/guard';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { Invalid } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';
import {
  approveEntry,
  createEntry,
  disableEntry,
  mergeEntry,
  rejectEntry,
  renameEntry,
} from './catalog';

/**
 * One form action of the catalog console: only an admin gets in (the hook 404s everyone else, and
 * this checks again), the form is validated by its schema, and the service authorizes the actor a
 * third time. What the service refuses goes back on the field it names, or on the form.
 */
function catalogAction<Schema extends ZodType>(
  schema: Schema,
  apply: (db: AnyDb, actor: Actor | null, data: z.infer<Schema>) => Promise<string>,
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(schema as never));
    if (!form.valid) return fail(400, { form });

    let eventId: string;
    try {
      eventId = await apply(locals.db, await locals.getProfile(), form.data as z.infer<Schema>);
    } catch (e) {
      if (e instanceof Invalid) {
        // A field the form does not show (the id) is an error of the form itself.
        const field = e.field in (form.data as object) ? e.field : '';
        return setError(form, field as never, e.message, { status: 400 });
      }
      throw e;
    }

    // The record is written with the change; the dispatch (no handler yet, it marks it done) comes after.
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.platform?.env), eventId, new Date(), locals.log),
    );
    return { form };
  };
}

/** The console's actions, for the queue and the catalog pages to share. */
export const catalogActions = {
  approve: catalogAction(entrySchema, (db, actor, { kind, id }) =>
    approveEntry(db, actor, kind, id),
  ),
  reject: catalogAction(entrySchema, (db, actor, { kind, id }) => rejectEntry(db, actor, kind, id)),
  disable: catalogAction(entrySchema, (db, actor, { kind, id }) =>
    disableEntry(db, actor, kind, id),
  ),
  rename: catalogAction(renameSchema, (db, actor, { kind, id, name }) =>
    renameEntry(db, actor, kind, id, name),
  ),
  merge: catalogAction(mergeSchema, (db, actor, { kind, id, into }) =>
    mergeEntry(db, actor, kind, id, into),
  ),
  create: catalogAction(createSchema, (db, actor, { kind, name }) =>
    createEntry(db, actor, kind, name),
  ),
};
