import { error, fail, redirect, type Action, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '$lib/forms/contract';
import { answerSchema, postponeSchema } from '$lib/tables/confirmation';
import { requireUser } from '../auth/guard';
import { safeNext } from '../auth/safe-next';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { Invalid, failFrom } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';
import { concludeTable, markTableNotHeld, postponeTable } from './lifecycle';

/**
 * One answer to "did the session happen?", posted from the GM's manage page. The form is validated
 * by its schema and the service authorizes the actor (and the table's state) again. A browser with
 * JavaScript gets the result back and reloads its data; one without is redirected back to the page.
 */
function confirmationAction<Schema extends ZodType>(
  schema: Schema,
  fields: readonly string[],
  apply: (
    db: AnyDb,
    actor: Actor | null,
    slug: string,
    data: z.infer<Schema>,
  ) => Promise<{ eventId: string }>,
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url, params } = event;
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = validateStringForm(await request.formData(), schema, fields);
    if (!form.valid) return fail(400, { form });

    let eventId: string;
    try {
      ({ eventId } = await apply(
        locals.db,
        await locals.getProfile(),
        params.slug!,
        form.data as z.infer<Schema>,
      ));
    } catch (e) {
      if (e instanceof Invalid) {
        form.valid = false;
        form.errors[e.field in (form.data as object) ? e.field : '_errors'] = [e.message];
        return fail(400, { form });
      }
      return failFrom(e);
    }

    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.platform?.env), eventId, new Date(), locals.log),
    );
    if (!request.headers.has('x-sveltekit-action')) {
      redirect(303, safeNext((form.data as { next: string }).next, url.pathname));
    }
    return { form };
  };
}

/** The manage page's actions: it happened, it did not, or a new date. */
export const confirmationActions = {
  happened: confirmationAction(answerSchema, ['next'], (db, actor, slug) =>
    concludeTable(db, actor, slug),
  ),
  notHeld: confirmationAction(answerSchema, ['next'], (db, actor, slug) =>
    markTableNotHeld(db, actor, slug),
  ),
  postpone: confirmationAction(
    postponeSchema,
    ['startsAtLocal', 'next'],
    (db, actor, slug, { startsAtLocal }) => postponeTable(db, actor, slug, startsAtLocal),
  ),
};
