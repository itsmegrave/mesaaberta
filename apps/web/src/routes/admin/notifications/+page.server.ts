import { error, redirect } from '@sveltejs/kit';
import { initialForm, validateFormData } from '$lib/forms/contract';
import { formMessage, refuse } from '$lib/forms/server';
import { announcementSchema, ANNOUNCEMENT_DEFAULTS } from '$lib/notifications/announcement';
import type { AnnouncementMessage } from '$lib/notifications/announcement-message';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { Invalid } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { callApiRaw } from '$lib/server/api-client';
import {
  audienceSizes,
  listAnnouncements,
  sendAnnouncement,
} from '@mesaaberta/core/server/notifications/announcements';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, each load and action
// checks again with `requireAdmin`, and `sendAnnouncement` authorizes the actor itself.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  const [form, sizes, history] = await Promise.all([
    Promise.resolve(initialForm(ANNOUNCEMENT_DEFAULTS)),
    audienceSizes(locals.db),
    listAnnouncements(locals.db),
  ]);
  return { form, sizes, history };
};

export const actions: Actions = {
  default: async (event) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);
    if (!locals.db) error(503, 'Database not configured');

    const form = validateFormData(
      await request.formData(),
      announcementSchema,
      ANNOUNCEMENT_DEFAULTS,
      { booleans: ['confirmed'] },
    );
    if (!form.valid)
      return formMessage(form, { code: 'invalid' } as AnnouncementMessage, { status: 400 });

    const profile = await locals.getProfile();
    let result: SendOutcome;
    try {
      // Through the api Worker when `api_admin_announcements` is on; here when it is off or the call
      // cannot be made. A refusal the api made is the form's refusal, never repeated here.
      const remote = profile ? await viaApi(locals, profile.id, form.data) : null;
      result = remote ?? (await sendAnnouncement(locals.db, profile, form.data));
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

/** The api's answer as the service's own result, a thrown `Invalid` for its refusals, or null. */
async function viaApi(
  locals: App.Locals,
  adminId: string,
  data: unknown,
): Promise<SendOutcome | null> {
  if (!(await locals.flags.isEnabled('api_admin_announcements', { id: adminId, isAdmin: true })))
    return null;
  const answer = await callApiRaw(locals.env, '/v1/admin/announcements', adminId, locals.log, data);
  if (!answer) return null;

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

  locals.log.warn('api announcement not used', {
    code: 'api_call_refused',
    status: answer.status,
    reason: typeof body.error === 'string' ? body.error : undefined,
  });
  return null;
}
