import { error, redirect } from '@sveltejs/kit';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { announcementSchema } from '$lib/notifications/announcement';
import type { AnnouncementMessage } from '$lib/notifications/announcement-message';
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

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and `sendAnnouncement`
// checks again.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const [form, sizes, history] = await Promise.all([
    superValidate(zod4(announcementSchema)),
    audienceSizes(locals.db),
    listAnnouncements(locals.db),
  ]);
  return { form, sizes, history };
};

export const actions: Actions = {
  default: async (event) => {
    const { locals, request, url } = event;
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(announcementSchema));
    if (!form.valid)
      return message(form, { code: 'invalid' } as AnnouncementMessage, { status: 400 });

    let result;
    try {
      result = await sendAnnouncement(locals.db, await locals.getProfile(), form.data);
    } catch (e) {
      if (e instanceof Invalid && e.field === 'recipient') {
        return setError(form, 'recipient', e.message);
      }
      if (e instanceof Invalid && e.field === 'audience') {
        return message(form, { code: 'empty' } as AnnouncementMessage, { status: 400 });
      }
      throw e;
    }

    if (result.step === 'confirm') {
      return message(form, {
        code: 'confirm',
        count: result.count,
        recipient: result.recipient?.username,
      } as AnnouncementMessage);
    }

    // After the response, so a large audience never holds up the page; the sweeper retries it.
    const { eventId } = result;
    locals.afterResponse((db) => dispatchEvent(db, handlersFor(event.platform?.env), eventId));
    redirect(303, url.pathname);
  },
};
