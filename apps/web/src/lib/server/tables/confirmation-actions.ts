import { error, fail, redirect, type Action, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import { answerSchema, heldSchema, postponeSchema } from '#lib/tables/confirmation.js';
import { requireUser } from '../auth/guard';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { Invalid } from '@mesaaberta/core/server/errors';
import { failFrom } from '../fail-from';
import { writeViaApi } from '../api-write';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import type { TableLifecycleActionName } from '@mesaaberta/core/server/tables/lifecycle-actions';

/**
 * One answer to "did the session happen?", posted from the GM's manage page. The form is validated
 * by its schema and the api Worker makes it (`/v1/manage/<slug>/<action>`), authorizing the actor
 * and the table's state again. A browser with JavaScript gets the result back and reloads its data;
 * one without is redirected back to the page.
 */
function confirmationAction<Schema extends ZodType>(
  schema: Schema,
  fields: readonly string[],
  action: TableLifecycleActionName,
  body?: (data: z.infer<Schema>, present?: string[]) => Record<string, unknown>,
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url, params } = event;
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const formData = await request.formData();
    const form = validateStringForm(formData, schema, fields);
    if (!form.valid) return fail(400, { form });

    let eventId: string;
    try {
      const data = form.data as z.infer<Schema>;
      // The checkboxes are the players present. A form without the `attendance` marker (no
      // confirmed players, or an old page) marks nobody.
      const present = formData.has('attendance')
        ? formData.getAll('present').filter((id): id is string => typeof id === 'string')
        : undefined;
      const written = await writeViaApi(
        locals,
        user,
        `/v1/manage/${encodeURIComponent(params.slug!)}/${action}`,
        body?.(data, present) ?? {},
      );
      eventId = written.eventIds[0];
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
  publish: confirmationAction(answerSchema, ['next'], 'publish'),
  happened: confirmationAction(answerSchema, ['next'], 'happened', (_data, present) =>
    present ? { presentPlayerIds: present } : {},
  ),
  // It happened and more sessions follow: the table stays open for the next one.
  sessionHeld: confirmationAction(
    heldSchema,
    ['nextStartsAtLocal', 'next'],
    'sessionHeld',
    ({ nextStartsAtLocal }, present) => ({
      ...(present ? { presentPlayerIds: present } : {}),
      ...(nextStartsAtLocal ? { nextStartsAtLocal } : {}),
    }),
  ),
  // It did not happen and the campaign or adventure goes on: the table opens for the next session.
  sessionSkipped: confirmationAction(
    heldSchema,
    ['nextStartsAtLocal', 'next'],
    'sessionSkipped',
    ({ nextStartsAtLocal }) => (nextStartsAtLocal ? { nextStartsAtLocal } : {}),
  ),
  // The GM ends a campaign or adventure that went on.
  finish: confirmationAction(answerSchema, ['next'], 'finish'),
  // The GM lets the checked players rate while the table goes on.
  allowRatings: confirmationAction(answerSchema, ['next'], 'allowRatings', (_data, players) => ({
    playerIds: players ?? [],
  })),
  notHeld: confirmationAction(answerSchema, ['next'], 'notHeld'),
  postpone: confirmationAction(
    postponeSchema,
    ['startsAtLocal', 'next'],
    'postpone',
    ({ startsAtLocal }) => ({ startsAtLocal }),
  ),
};
