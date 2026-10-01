import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '$lib/forms/contract';
import { requireAdmin } from '../admin-access';
import { requireUser } from '../auth/guard';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import { handlersFor } from '../events/handlers';

type Apply<Schema extends ZodType> = (
  db: AnyDb,
  actor: Actor | null,
  data: z.output<Schema>,
  event: RequestEvent,
) => Promise<string | string[]>;

/**
 * One moderation form action, for the report dialog and the admin console alike: a signed-in user
 * (and, with `admin`, only an admin: everyone else gets the 404 the admin area answers), the form
 * checked by its schema over the named text fields, and the service deciding. What the service
 * refuses comes back as a code on the field it names, or on the form; the events it wrote are
 * dispatched after the response. Pairs with `actionForm` on the page.
 */
export function moderationAction<Schema extends ZodType>(
  schema: Schema,
  fields: readonly string[],
  apply: Apply<Schema>,
  { admin = false }: { admin?: boolean } = {},
) {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
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
      const written = await apply(locals.db, await locals.getProfile(), form.data, event);
      eventIds = Array.isArray(written) ? written : [written];
    } catch (cause) {
      if (cause instanceof Invalid) return refuse(400, cause.field, cause.message);
      if (cause instanceof RateLimited) return refuse(429, '', 'rate_limited');
      if (cause instanceof Forbidden) return refuse(403, '', 'forbidden');
      if (cause instanceof NotFound) return refuse(404, '', 'not_found');
      throw cause;
    }

    const handlers = handlersFor(event.platform?.env);
    locals.afterResponse(async (db) => {
      for (const id of eventIds) await dispatchEvent(db, handlers, id, new Date(), locals.log);
    });
    return { form };
  };
}
