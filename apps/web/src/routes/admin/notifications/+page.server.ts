import { error, redirect } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { formMessage, refuse } from '#lib/forms/server.js';
import { announcementSchema, ANNOUNCEMENT_DEFAULTS } from '#lib/notifications/announcement.js';
import type { AnnouncementMessage } from '#lib/notifications/announcement-message.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { Invalid } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { callApiRaw } from '#lib/server/api-client.js';
import type {
  audienceSizes,
  listAnnouncements,
} from '@mesaaberta/core/server/notifications/announcements';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, each load and action
// checks again with `requireAdmin`, and the api authorizes the actor itself.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);

  const { sizes, history } = revivedDates(
    await readFromApi<{
      sizes: Awaited<ReturnType<typeof audienceSizes>>;
      history: Awaited<ReturnType<typeof listAnnouncements>>;
    }>(locals, user.id, '/v1/admin-reads/announcements'),
  );
  return { form: initialForm(ANNOUNCEMENT_DEFAULTS), sizes, history };
};

export const actions: Actions = {
  default: async (event) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);

    const form = validateFormData(
      await request.formData(),
      announcementSchema,
      ANNOUNCEMENT_DEFAULTS,
      { booleans: ['confirmed'] },
    );
    if (!form.valid)
      return formMessage(form, { code: 'invalid' } as AnnouncementMessage, { status: 400 });

    const user = await locals.getUser();
    let result: SendOutcome;
    try {
      // The api Worker counts the audience and sends; a refusal it made is the form's refusal.
      result = await viaApi(locals, user!.id, form.data);
    } catch (e) {
      if (e instanceof Invalid && e.field === 'recipient') {
        return refuse(form, 400, e.message, 'recipient');
      }
      if (e instanceof Invalid && e.field === 'audience') {
        return formMessage(form, { code: 'empty' } as AnnouncementMessage, { status: 400 });
      }
      throw e;
    }

    if (result.step === 'confirm') {
      return formMessage(form, {
        code: 'confirm',
        count: result.count,
        recipient: result.recipient?.username,
      } as AnnouncementMessage);
    }

    // After the response, so a large audience never holds up the page; the sweeper retries it.
    const { eventId } = result;
    locals.afterResponse((db) =>
      dispatchEvent(db, handlersFor(event.locals.env), eventId, new Date(), locals.log),
    );
    redirect(303, url.pathname);
  },
};

type SendOutcome =
  | { step: 'confirm'; count: number; recipient: { username: string } | null }
  | { step: 'sent'; count: number; eventId: string };

/** The api's answer as the service's own result, a thrown `Invalid` for its refusals, or a 503. */
async function viaApi(locals: App.Locals, adminId: string, data: unknown): Promise<SendOutcome> {
  const answer = await callApiRaw(locals.env, '/v1/admin/announcements', adminId, locals.log, data);
  if (!answer) error(503, 'API unavailable');

  const body = (answer.body ?? {}) as Record<string, unknown>;
  if (answer.ok && body.step === 'confirm' && typeof body.count === 'number')
    return {
      step: 'confirm',
      count: body.count,
      recipient:
        body.recipient && typeof (body.recipient as { username?: unknown }).username === 'string'
          ? { username: (body.recipient as { username: string }).username }
          : null,
    };
  if (
    answer.ok &&
    body.step === 'sent' &&
    Array.isArray(body.eventIds) &&
    typeof body.eventIds[0] === 'string' &&
    typeof body.count === 'number'
  )
    return { step: 'sent', count: body.count, eventId: body.eventIds[0] };
  if (answer.status === 400 && body.error === 'invalid' && typeof body.field === 'string')
    throw new Invalid(body.field, typeof body.message === 'string' ? body.message : 'invalid');

  locals.log.warn('api announcement failed', {
    code: 'api_call_failed',
    status: answer.status,
    reason: typeof body.error === 'string' ? body.error : undefined,
  });
  error(503, 'API unavailable');
}
