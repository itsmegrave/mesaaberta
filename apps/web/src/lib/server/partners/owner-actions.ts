import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { z, ZodType } from 'zod';
import { validateStringForm, type FormResult } from '#lib/forms/contract.js';
import { formMessage, refuse } from '#lib/forms/server.js';
import { writeViaApi } from '../api-write';
import { requireUser } from '../auth/guard';
import { can } from '@mesaaberta/core/server/auth/policy';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';

/**
 * Whether "Quem cuida do parceiro" is on for a person (`use_partner_owners`): the section on the edit
 * page and inviting. Answering an invite that was sent does not depend on it.
 */
export async function partnerOwnersEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: Parameters<typeof can>[0] & { id: string },
): Promise<boolean> {
  return locals.flags.isEnabled('use_partner_owners', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}

/**
 * A form action of "Quem cuida do parceiro" or of the invite page: validates `fields` with `schema`,
 * makes the api write `call` names (`[path, body]`; the service there authorizes) and dispatches the
 * events it returns after the response.
 * A refusal answers with its code on the form (`unavailable`, `too_many`, `last_owner`,
 * `rate_limited`), a vanished partner or invite with `not_found`. `flagged` actions refuse while
 * `use_partner_owners` is off for the person. `then` may redirect once it went through.
 */
export function ownerAction<S extends ZodType>(
  schema: S,
  fields: readonly string[],
  call: (
    data: z.output<S>,
    params: Record<string, string>,
  ) => [path: string, body: Record<string, unknown>],
  { flagged = true, then }: { flagged?: boolean; then?: (data: z.output<S>) => string | null } = {},
) {
  return async ({ locals, url, params, request }: RequestEvent) => {
    await requireUser(locals, url);
    const checked = validateStringForm(await request.formData(), schema, fields);
    const form = checked as FormResult<Record<string, unknown>>;
    if (!form.valid) return fail(400, { form });
    const actor = await locals.getProfile();
    if (!actor) error(403, 'Forbidden');
    if (flagged && !(await partnerOwnersEnabled(locals, actor)))
      return formMessage(form, { code: 'forbidden' }, { status: 403 });
    try {
      const [path, body] = call(checked.data, params as Record<string, string>);
      const { eventIds } = await writeViaApi(locals, actor, path, body);
      for (const eventId of eventIds)
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(locals.env), eventId, new Date(), locals.log),
        );
    } catch (cause) {
      if (cause instanceof Invalid) return refuse(form, 400, cause.message, fields[0]);
      if (cause instanceof RateLimited)
        return formMessage(
          form,
          { code: 'rate_limited', retryAfter: cause.retryAfterSeconds },
          { status: 429 },
        );
      if (cause instanceof NotFound)
        return formMessage(form, { code: 'not_found' }, { status: 404 });
      if (cause instanceof Forbidden)
        return formMessage(form, { code: 'forbidden' }, { status: 403 });
      throw cause;
    }
    const next = then?.(checked.data);
    if (next) redirect(303, next);
    return { form };
  };
}
