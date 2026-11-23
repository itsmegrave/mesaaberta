import { fail } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { requireCalendarFeed } from '#lib/server/calendar-feed.js';
import { calendarFeedSchema, calendarFeedUrls } from '@mesaaberta/core/calendar/feed-form';
import type { Actions, PageServerLoad } from './$types';

// "Assinar agenda": whether the person has a calendar feed. Only its hash is kept, so the address
// itself comes back once, from the action that makes it.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireCalendarFeed(locals, user.id);
  const { on } = await readFromApi<{ on: boolean }>(locals, user.id, '/v1/me/calendar-feed');
  return { on };
};

export const actions: Actions = {
  // A new secret (the old address stops) or none.
  feed: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireCalendarFeed(locals, user.id);
    const form = validateStringForm(await request.formData(), calendarFeedSchema, ['on']);
    if (!form.valid) return fail(400, { form });
    const { body } = await writeViaApi(locals, user, '/v1/me/calendar-feed', {
      on: form.data.on === 'true',
    });
    // The new address, shown this once.
    const token = typeof body.token === 'string' ? body.token : null;
    return { form, feed: token ? calendarFeedUrls(url.origin, token) : null };
  },
};
