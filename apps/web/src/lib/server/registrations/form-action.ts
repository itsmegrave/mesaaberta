import { error, redirect } from '@sveltejs/kit';
import { validateStringForm } from '$lib/forms/contract';
import { formMessage } from '$lib/forms/server';
import type { z } from 'zod';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { requireUser } from '../auth/guard';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { RateLimited } from '@mesaaberta/core/server/errors';
import { failFrom } from '../fail-from';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import type { RegistrationActionName } from '@mesaaberta/core/server/registrations/decisions';
import {
  Forbidden,
  Invalid,
  NotFound,
  TableFull,
  AlreadyRegistered,
} from '@mesaaberta/core/server/errors';
import { callApiRaw } from '../api-client';

type Event = {
  locals: App.Locals;
  url: URL;
  request: Request;
  setHeaders?: (headers: Record<string, string>) => void;
};

/** The refusal an api answer stands for, as the domain error `failFrom` already knows. */
function refusalOf(status: number, body: Record<string, unknown>): Error | null {
  if (status === 400 && body.error === 'invalid')
    return new Invalid(typeof body.field === 'string' ? body.field : '');
  if (status === 403 && body.error === 'forbidden') return new Forbidden();
  if (status === 404 && body.error === 'not_found') return new NotFound();
  if (status === 409 && body.error === 'table_full') return new TableFull();
  if (status === 409 && body.error === 'already_registered') return new AlreadyRegistered();
  if (status === 429 && body.error === 'rate_limited')
    return new RateLimited(typeof body.retryAfter === 'number' ? body.retryAfter : 60);
  return null;
}

/**
 * Makes the registration action in the api Worker when `api_registrations` is on for this player.
 * Resolves to its events, throws the refusal it made (so the form shows it as it always did), and
 * resolves to null when the flag is off or the call cannot be used: the caller then runs the
 * service in this Worker, so the flag is a kill switch and not a dependency.
 */
async function viaApi(
  locals: App.Locals,
  playerId: string,
  call: { action: RegistrationActionName; slug: string; body: Record<string, unknown> },
): Promise<{ eventIds: string[] } | null> {
  if (!(await locals.flags.isEnabled('api_registrations', { id: playerId }))) return null;
  const path = `/v1/tables/${encodeURIComponent(call.slug)}/${call.action}`;
  const answer = await callApiRaw(locals.env, path, playerId, locals.log, call.body);
  if (!answer) return null;
  const body = (answer.body ?? {}) as Record<string, unknown>;
  if (
    answer.ok &&
    Array.isArray(body.eventIds) &&
    body.eventIds.every((i) => typeof i === 'string')
  )
    return { eventIds: body.eventIds as string[] };
  const refusal = refusalOf(answer.status, body);
  if (refusal) throw refusal;
  locals.log.warn('api registration not used', {
    code: 'api_call_refused',
    path,
    status: answer.status,
  });
  return null;
}

/**
 * What every join, leave, approve, decline and remove action shares: an anonymous visitor goes to
 * log in, and one without a username yet to finish the profile; the operation runs as the signed-in player; the events it wrote are dispatched after the
 * response; then the browser goes back to the page. A domain error (a full table, a refused
 * permission) becomes a form failure the page can show; anything else is a bug and surfaces.
 */
export async function runRegistrationAction<T extends Record<string, unknown>>(
  event: Event,
  schema: z.ZodType<T>,
  run: (db: AnyDb, actor: Actor | null, data: T) => Promise<{ eventIds: string[] }>,
  /** The same operation for the api Worker, behind `api_registrations`; `run` stays the fallback. */
  api?: (data: T) => {
    action: RegistrationActionName;
    slug: string;
    body: Record<string, unknown>;
  },
) {
  const { locals, url, request } = event;
  // The page itself, not the `?/join` action address, which only makes sense as a POST.
  await requireUser(locals, new URL(url.pathname, url));
  if (!locals.db) error(503, 'Database not configured');

  const form = validateStringForm(await request.formData(), schema, [
    'playerId',
    'next',
    'gmScore',
    'comment',
    'message',
  ]);
  if (!form.valid) return formMessage(form, { code: 'invalid' }, { status: 400 });

  try {
    const profile = await locals.getProfile();
    const data = form.data as T;
    const { eventIds } =
      (api && profile ? await viaApi(locals, profile.id, api(data)) : null) ??
      (await run(locals.db, profile, data));
    for (const id of eventIds)
      locals.afterResponse((db) =>
        dispatchEvent(db, handlersFor(event.locals.env), id, new Date(), locals.log),
      );
  } catch (e) {
    if (e instanceof RateLimited) {
      event.setHeaders?.({ 'Retry-After': String(e.retryAfterSeconds) });
    }
    const failure = failFrom(e);
    return formMessage(
      form,
      {
        code: failure.data.error,
        field: 'field' in failure.data ? failure.data.field : undefined,
        retryAfter: 'retryAfter' in failure.data ? failure.data.retryAfter : undefined,
      },
      { status: failure.status },
    );
  }

  // Back to where the form was: the table page, or the dashboard when it names itself in `next`.
  redirect(303, safeNext(String((form.data as Record<string, unknown>).next ?? ''), url.pathname));
}
