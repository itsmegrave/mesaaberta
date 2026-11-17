import { fail } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { requireCalendarFeed } from '#lib/server/calendar-feed.js';
import { calendarFeedSchema, calendarFeedUrls } from '@mesaaberta/core/calendar/feed-form';
import type { Actions, PageServerLoad } from './$types';

// "Assinar agenda": the person's calendar feed address, which a calendar app keeps up to date.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireCalendarFeed(locals, user.id);
  const { token } = await readFromApi<{ token: string | null }>(
    locals,
    user.id,
    '/v1/me/calendar-feed',
  );
  return { feed: token ? calendarFeedUrls(url.origin, token) : null };
};

export const actions: Actions = {
  // A new secret (the old address stops) or none.
  feed: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireCalendarFeed(locals, user.id);
    const form = validateStringForm(await request.formData(), calendarFeedSchema, ['on']);
    if (!form.valid) return fail(400, { form });
    await writeViaApi(locals, user, '/v1/me/calendar-feed', { on: form.data.on === 'true' });
    return { form };
  },
};
