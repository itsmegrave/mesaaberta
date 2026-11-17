import { fail, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireAdmin } from '../admin-access';
import { decideViaApi } from '../api-decide';
import { requireUser } from '../auth/guard';
import { writeViaApi } from '../api-write';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';

/**
 * The api route that makes the action, and the body its schema wants (the checked form by default).
 * `allow` is a check the web Worker makes first (a flag): false answers `forbidden` like a refusal.
 */
type ViaApi<Schema extends ZodType> = {
  path: string | ((event: RequestEvent, data: z.output<Schema>) => string);
  body?: (data: z.output<Schema>, event: RequestEvent) => object;
  allow?: (event: RequestEvent) => Promise<boolean>;
};

/**
 * One moderation form action, for the report dialog and the admin console alike: a signed-in user
 * (and, with `admin`, only an admin: everyone else gets the 404 the admin area answers), the form
 * checked by its schema over the named text fields, and then either the api route that makes it
 * (an admin decision, a member's report or withdrawal). What is refused comes back as a code on the field it names, or on the
 * form; the api delivers the events it writes. Pairs with `actionForm` on the page.
 */
export function moderationAction<Schema extends ZodType>(
  schema: Schema,
  fields: readonly string[],
  how: ViaApi<Schema>,
  { admin = false }: { admin?: boolean } = {},
) {
  return async (event: RequestEvent) => {
    const { locals, request, url } = event;
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (admin) await requireAdmin(locals);

    const form = validateStringForm(await request.formData(), schema, fields);
    if (!form.valid) return fail(400, { form });

    const refuse = (status: 400 | 403 | 404 | 429, field: string, code: string) => {
      form.valid = false;
      form.errors[field in (form.data as object) ? field : '_errors'] = [code];
      return fail(status, { form });
    };

    try {
      if (how.allow && !(await how.allow(event))) throw new Forbidden();
      const body = how.body ? how.body(form.data, event) : (form.data as object);
      const path = typeof how.path === 'function' ? how.path(event, form.data) : how.path;
      if (admin) {
        const decided = await decideViaApi(locals, path, user.id, body);
        if (decided.kind === 'refused') return refuse(decided.status, decided.field, decided.code);
      } else {
        await writeViaApi(locals, user, path, { ...body });
      }
    } catch (cause) {
      if (cause instanceof Invalid) return refuse(400, cause.field, cause.message);
      if (cause instanceof RateLimited) return refuse(429, '', 'rate_limited');
      if (cause instanceof Forbidden) return refuse(403, '', 'forbidden');
      if (cause instanceof NotFound) return refuse(404, '', 'not_found');
      throw cause;
    }
    return { form };
  };
}
