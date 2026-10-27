import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireAdmin } from '../admin-access';
import { decideViaApi } from '../api-decide';
import { requireUser } from '../auth/guard';
import { writeViaApi } from '../api-write';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';

type Apply<Schema extends ZodType> = (
  db: AnyDb,
  actor: Actor | null,
  data: z.output<Schema>,
  event: RequestEvent,
) => Promise<string | string[]>;

/** The api route that makes the action, and the body its schema wants (the checked form by default). */
type ViaApi<Schema extends ZodType> = {
  path: string;
  body?: (data: z.output<Schema>, event: RequestEvent) => object;
};

/**
 * One moderation form action, for the report dialog and the admin console alike: a signed-in user
 * (and, with `admin`, only an admin: everyone else gets the 404 the admin area answers), the form
 * checked by its schema over the named text fields, and then either the api route that makes it
 * (an admin decision, a member's report or withdrawal) or, for the actions it does not serve yet,
 * the service in this Worker. What is refused comes back as a code on the field it names, or on the
 * form; the events written are dispatched after the response. Pairs with `actionForm` on the page.
 */
export function moderationAction<Schema extends ZodType>(
  schema: Schema,
  fields: readonly string[],
  how: Apply<Schema> | ViaApi<Schema>,
  { admin = false }: { admin?: boolean } = {},
) {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (admin) await requireAdmin(locals);
    if (!locals.db) error(503, 'Database not configured');

    const form = validateStringForm(await request.formData(), schema, fields);
    if (!form.valid) return fail(400, { form });

    const refuse = (status: 400 | 403 | 404 | 429, field: string, code: string) => {
      form.valid = false;
      form.errors[field in (form.data as object) ? field : '_errors'] = [code];
      return fail(status, { form });
    };

    let eventIds: string[];
    try {
      if (typeof how === 'function') {
        const written = await how(locals.db, await locals.getProfile(), form.data, event);
        eventIds = Array.isArray(written) ? written : [written];
      } else {
        const body = how.body ? how.body(form.data, event) : (form.data as object);
        if (admin) {
          const decided = await decideViaApi(locals, how.path, user.id, body);
          if (decided.kind === 'refused')
            return refuse(decided.status, decided.field, decided.code);
          eventIds = decided.eventIds;
        } else {
          eventIds = (await writeViaApi(locals, user, how.path, { ...body })).eventIds;
        }
      }
    } catch (cause) {
      if (cause instanceof Invalid) return refuse(400, cause.field, cause.message);
      if (cause instanceof RateLimited) return refuse(429, '', 'rate_limited');
      if (cause instanceof Forbidden) return refuse(403, '', 'forbidden');
      if (cause instanceof NotFound) return refuse(404, '', 'not_found');
      throw cause;
    }

    const handlers = handlersFor(event.locals.env);
    const dispatched = eventIds;
    locals.afterResponse(async (db) => {
      for (const id of dispatched) await dispatchEvent(db, handlers, id, new Date(), locals.log);
    });
    return { form };
  };
}
