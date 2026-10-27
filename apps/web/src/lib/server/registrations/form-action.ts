import { error, redirect } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
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
import { writeViaApi } from '../api-write';

type Event = {
  locals: App.Locals;
  url: URL;
  request: Request;
  setHeaders?: (headers: Record<string, string>) => void;
};

/**
 * What every join, leave, approve, decline and remove action shares: an anonymous visitor goes to
 * log in, and one without a username yet to finish the profile; the operation runs as the signed-in player; the events it wrote are dispatched after the
 * response; then the browser goes back to the page. A domain error (a full table, a refused
 * permission) becomes a form failure the page can show; anything else is a bug and surfaces.
 */
export async function runRegistrationAction<T extends Record<string, unknown>>(
  event: Event,
  schema: z.ZodType<T>,
  /**
   * The api route that makes it (`/v1/tables/<slug>/<action>`), or, for an operation the api does
   * not serve yet, the service in this Worker.
   */
  how:
    | ((db: AnyDb, actor: Actor | null, data: T) => Promise<{ eventIds: string[] }>)
    | {
        api: (data: T) => {
          action: RegistrationActionName;
          slug: string;
          body: Record<string, unknown>;
        };
      },
) {
  const { locals, url, request } = event;
  // The page itself, not the `?/join` action address, which only makes sense as a POST.
  const user = await requireUser(locals, new URL(url.pathname, url));
  if (!locals.db) error(503, 'Database not configured');

  const form = validateStringForm(await request.formData(), schema, [
    'playerId',
    'next',
    'gmScore',
    'score',
    'comment',
    'commentPublic',
    'message',
  ]);
  if (!form.valid) return formMessage(form, { code: 'invalid' }, { status: 400 });

  try {
    const data = form.data as T;
    let eventIds: string[];
    if (typeof how === 'function') {
      eventIds = (await how(locals.db, await locals.getProfile(), data)).eventIds;
    } else {
      const call = how.api(data);
      eventIds = (
        await writeViaApi(
          locals,
          user,
          `/v1/tables/${encodeURIComponent(call.slug)}/${call.action}`,
          call.body,
        )
      ).eventIds;
    }
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
