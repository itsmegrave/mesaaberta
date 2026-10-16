import { error, fail, redirect, type Action, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import { answerSchema, postponeSchema } from '#lib/tables/confirmation.js';
import { requireUser } from '../auth/guard';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { Invalid } from '@mesaaberta/core/server/errors';
import { failFrom } from '../fail-from';
import { writeViaApi } from '../api-write';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import {
  concludeTable,
  markTableNotHeld,
  postponeTable,
} from '@mesaaberta/core/server/tables/lifecycle';
import { publishTable } from '@mesaaberta/core/server/tables/write';
import type { TableLifecycleActionName } from '@mesaaberta/core/server/tables/lifecycle-actions';

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
  /** The same answer for the api Worker, behind `api_table_lifecycle`; `apply` stays the fallback. */
  api?: {
    action: TableLifecycleActionName;
    body?: (data: z.infer<Schema>) => Record<string, unknown>;
  },
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url, params } = event;
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = validateStringForm(await request.formData(), schema, fields);
    if (!form.valid) return fail(400, { form });

    let eventId: string;
    try {
      const profile = await locals.getProfile();
      const data = form.data as z.infer<Schema>;
      const remote =
        api && profile
          ? await writeViaApi(
              locals,
              'api_table_lifecycle',
              profile,
              `/v1/manage/${encodeURIComponent(params.slug!)}/${api.action}`,
              api.body?.(data) ?? {},
            )
          : null;
      eventId =
        remote?.eventIds[0] ?? (await apply(locals.db, profile, params.slug!, data)).eventId;
    } catch (e) {
      if (e instanceof Invalid) {
        form.valid = false;
        form.errors[e.field in (form.data as object) ? e.field : '_errors'] = [e.message];
        return fail(400, { form });
      }
      return failFrom(e);
    }

    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.locals.env), eventId, new Date(), locals.log),
    );
    if (!request.headers.has('x-sveltekit-action')) {
      redirect(303, safeNext((form.data as { next: string }).next, url.pathname));
    }
    return { form };
  };
}

/** The manage page's actions: it happened, it did not, a new date, or a draft going public. */
export const confirmationActions = {
  publish: confirmationAction(
    answerSchema,
    ['next'],
    (db, actor, slug) => publishTable(db, actor, slug),
    { action: 'publish' },
  ),
  happened: confirmationAction(
    answerSchema,
    ['next'],
    (db, actor, slug) => concludeTable(db, actor, slug),
    { action: 'happened' },
  ),
  notHeld: confirmationAction(
    answerSchema,
    ['next'],
    (db, actor, slug) => markTableNotHeld(db, actor, slug),
    { action: 'notHeld' },
  ),
  postpone: confirmationAction(
    postponeSchema,
    ['startsAtLocal', 'next'],
    (db, actor, slug, { startsAtLocal }) => postponeTable(db, actor, slug, startsAtLocal),
    { action: 'postpone', body: ({ startsAtLocal }) => ({ startsAtLocal }) },
  ),
};
