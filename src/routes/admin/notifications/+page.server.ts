import { error, redirect } from '@sveltejs/kit';
import { initialForm, validateFormData } from '$lib/forms/contract';
import { formMessage, refuse } from '$lib/forms/server';
import { announcementSchema, ANNOUNCEMENT_DEFAULTS } from '$lib/notifications/announcement';
import type { AnnouncementMessage } from '$lib/notifications/announcement-message';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { Invalid } from '$lib/server/errors';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import {
  audienceSizes,
  listAnnouncements,
  sendAnnouncement,
} from '$lib/server/notifications/announcements';
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

    let result;
    try {
      result = await sendAnnouncement(locals.db, await locals.getProfile(), form.data);
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
      dispatchEvent(db, handlersFor(event.platform?.env), eventId, new Date(), locals.log),
    );
    redirect(303, url.pathname);
  },
};
