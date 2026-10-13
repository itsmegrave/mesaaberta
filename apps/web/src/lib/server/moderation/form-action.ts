import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '$lib/forms/contract';
import { requireAdmin } from '../admin-access';
import { decideViaApi } from '../api-decide';
import { requireUser } from '../auth/guard';
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
  {
    admin = false,
    decision,
  }: {
    admin?: boolean;
    /**
     * The admin decision's name in `moderationDecisions`. With `api_admin_moderation` on for the
     * admin the api Worker makes it (`/v1/admin/moderation/<decision>`), and this Worker only
     * decides when the api cannot be reached or fails.
     */
    decision?: string;
  } = {},
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

    const profile = await locals.getProfile();
    let eventIds: string[] | undefined;
    if (admin && decision && profile) {
      const viaApi = await decideViaApi(
        locals,
        'api_admin_moderation',
        `/v1/admin/moderation/${decision}`,
        profile.id,
        form.data,
      );
      if (viaApi.kind === 'done') eventIds = viaApi.eventIds;
      else if (viaApi.kind === 'refused') return refuse(viaApi.status, viaApi.field, viaApi.code);
    }

    try {
      if (!eventIds) {
        const written = await apply(locals.db, profile, form.data, event);
        eventIds = Array.isArray(written) ? written : [written];
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
