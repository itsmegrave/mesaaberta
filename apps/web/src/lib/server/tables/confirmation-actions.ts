import { error, fail, redirect, type Action, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import {
  answerSchema,
  cancelSessionSchema,
  heldSchema,
  moveSessionSchema,
  noteSessionSchema,
  postponeSchema,
  scheduleSessionSchema,
  sessionPlayerSchema,
} from '#lib/tables/confirmation.js';
import { sessionSignupEnabled, tableSessionsEnabled } from './sessions-enabled';
import { requireUser } from '../auth/guard';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { Invalid } from '@mesaaberta/core/server/errors';
import { failFrom } from '../fail-from';
import { writeViaApi } from '../api-write';
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
  /** Answers whether the action is on; off, it is a 404. */
  gate?: (locals: App.Locals) => Promise<boolean>,
): Action {
  return async (event: RequestEvent) => {
    const { locals, request, url, params } = event;
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (gate && !(await gate(locals))) error(404, 'Not found');

    const formData = await request.formData();
    const form = validateStringForm(formData, schema, fields);
    if (!form.valid) return fail(400, { form });

    try {
      const data = form.data as z.infer<Schema>;
      // The checkboxes are the players present. A form without the `attendance` marker (no
      // confirmed players, or an old page) marks nobody.
      const present = formData.has('attendance')
        ? formData.getAll('present').filter((id): id is string => typeof id === 'string')
        : undefined;
      await writeViaApi(
        locals,
        user,
        `/v1/manage/${encodeURIComponent(params.slug!)}/${action}`,
        body?.(data, present) ?? {},
      );
    } catch (e) {
      if (e instanceof Invalid) {
        form.valid = false;
        form.errors[e.field in (form.data as object) ? e.field : '_errors'] = [e.message];
        return fail(400, { form });
      }
      return failFrom(e);
    }

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

/** Gerenciar mesa → Sessões is on for the person (`use_table_sessions`). */
const sessionsOn = async (locals: App.Locals) =>
  tableSessionsEnabled(locals, await locals.getProfile().catch(() => null));

/** Campanha aberta's places per session are on for the person (`use_session_signup`). */
const signupOn = async (locals: App.Locals) =>
  sessionSignupEnabled(locals, await locals.getProfile().catch(() => null));

/** Gerenciar mesa → Sessões: schedule one more, move one, write its note, cancel one. */
export const sessionActions = {
  scheduleSession: confirmationAction(
    scheduleSessionSchema,
    ['startsAtLocal', 'durationHours', 'note', 'next'],
    'scheduleSession',
    ({ startsAtLocal, durationHours, note }) => ({
      startsAtLocal,
      durationMinutes: Math.round(durationHours * 60),
      ...(note ? { note } : {}),
    }),
    sessionsOn,
  ),
  moveSession: confirmationAction(
    moveSessionSchema,
    ['sessionId', 'startsAtLocal', 'next'],
    'moveSession',
    ({ sessionId, startsAtLocal }) => ({ sessionId, startsAtLocal }),
    sessionsOn,
  ),
  noteSession: confirmationAction(
    noteSessionSchema,
    ['sessionId', 'note', 'next'],
    'noteSession',
    ({ sessionId, note }) => ({ sessionId, note }),
    sessionsOn,
  ),
  cancelSession: confirmationAction(
    cancelSessionSchema,
    ['sessionId', 'message', 'next'],
    'cancelSession',
    ({ sessionId, message }) => ({ sessionId, ...(message ? { message } : {}) }),
    sessionsOn,
  ),
  // Campanha aberta (`use_session_signup`): "Pôr na sessão" and "Tirar".
  addToSession: confirmationAction(
    sessionPlayerSchema,
    ['sessionId', 'playerId', 'next'],
    'addToSession',
    ({ sessionId, playerId }) => ({ sessionId, playerId }),
    signupOn,
  ),
  removeFromSession: confirmationAction(
    sessionPlayerSchema,
    ['sessionId', 'playerId', 'next'],
    'removeFromSession',
    ({ sessionId, playerId }) => ({ sessionId, playerId }),
    signupOn,
  ),
};
