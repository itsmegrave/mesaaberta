import { error, fail, redirect, type Action } from '@sveltejs/kit';
import { z } from 'zod';
import { validateStringForm } from '#lib/forms/contract.js';
import { invitationFormSchema } from '#lib/invitations/schema.js';
import { requireUser } from '../auth/guard';
import { requireApiWrite } from '../api-required';
import { failFrom } from '../fail-from';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { formMessage } from '#lib/forms/server.js';
import { Invalid, RateLimited } from '@mesaaberta/core/server/errors';
type Kind = 'invite' | 'cancel' | 'accept' | 'decline' | 'preference' | 'block';
export function invitationAction(kind: Kind): Action {
  return async ({ locals, url, params, request }) => {
    await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');
    const form = validateStringForm(await request.formData(), invitationFormSchema, [
      'username',
      'invitationId',
      'gmId',
      'enabled',
      'blocked',
    ]);
    if (!form.valid) return fail(400, { form });
    const data = form.data;
    try {
      const actor = await locals.getProfile();
      const id = params.id || data.invitationId;
      if (
        (['accept', 'decline', 'cancel'].includes(kind) && !z.uuid().safeParse(id).success) ||
        (kind === 'block' && !z.uuid().safeParse(data.gmId).success) ||
        (kind === 'invite' && !data.username)
      )
        throw new Invalid('invitation', 'unavailable');
      const path =
        kind === 'invite'
          ? `/v1/tables/${encodeURIComponent(params.slug!)}/invitations`
          : kind === 'preference'
            ? '/v1/account/invitation-preferences'
            : kind === 'block'
              ? '/v1/account/invitation-blocks'
              : `/v1/invitations/${id}/${kind}`;
      const body =
        kind === 'invite'
          ? { username: data.username }
          : kind === 'preference'
            ? { enabled: data.enabled === 'true' }
            : kind === 'block'
              ? { gmId: data.gmId, blocked: data.blocked === 'true' }
              : {};
      if (!actor) error(403, 'Forbidden');
      const result = await requireApiWrite(locals, actor, path, body);
      for (const eventId of result.eventIds)
        locals.afterResponse((db) =>
          dispatchEvent(db, handlersFor(locals.env), eventId, new Date(), locals.log),
        );
    } catch (cause) {
      if (cause instanceof RateLimited)
        return formMessage(
          form,
          { code: 'rate_limited', retryAfter: cause.retryAfterSeconds },
          { status: 429 },
        );
      if (cause instanceof Invalid) {
        form.valid = false;
        form.errors._errors = ['unavailable'];
        return fail(400, { form });
      }
      return failFrom(cause);
    }
    if (!request.headers.has('x-sveltekit-action')) redirect(303, url.pathname);
    return { form };
  };
}
