import { redirect } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { notificationActionSchema } from '#lib/notifications/actions.js';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '@mesaaberta/core/notifications/kinds';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { readNotifications } from '#lib/server/me.js';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import type { Actions, PageServerLoad } from './$types';

const categoryOf = (value: string | null): NotificationCategory | undefined =>
  NOTIFICATION_CATEGORIES.find((category) => category === value);

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);

  const profile = await locals.getProfile();
  const withAchievements = profile ? await badgesEnabled(locals, profile) : false;
  const category = categoryOf(url.searchParams.get('category'));
  const unread = url.searchParams.get('unread') === '1';
  const seenAt = new Date().toISOString();
  // A page past the last is the api's 404, which becomes the page's.
  const feed = await readNotifications(locals, user.id, {
    page: url.searchParams.get('page'),
    category,
    unread,
    withAchievements,
  });
  return {
    category: category ?? null,
    unread,
    page: feed.page,
    pages: feed.pages,
    // Every category and page counts for "mark all read", not only what this filter shows.
    unreadTotal: feed.unreadTotal,
    seenAt,
    // The "Conquistas" filter and the badge notices wait for the badges to be released.
    withAchievements,
    notifications: feed.items,
  };
};

/**
 * What the form sent: a field that fails the schema is dropped, so a bad id marks nothing and a bad
 * `next` falls back to the feed. Back is always on the site (the bell is on every page).
 */
async function submitted(request: Request) {
  const form = validateStringForm(await request.formData(), notificationActionSchema, [
    'id',
    'next',
    'until',
  ]);
  const id = form.errors.id ? undefined : form.data.id;
  const next = form.errors.next ? null : form.data.next;
  const until = form.errors.until ? undefined : form.data.until;
  return { id, until, back: safeNext(next, '/notifications') };
}

// Plain POST works without JavaScript. The anonymous visitor goes to log in first.
export const actions: Actions = {
  /** Opens a notification: marks it read and follows its link, or comes back when it has none. */
  open: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    const { id, back } = await submitted(request);
    const opened = id ? await writeViaApi(locals, user, '/v1/inbox/open', { id }) : null;
    const link = typeof opened?.body.link === 'string' ? opened.body.link : null;
    redirect(303, safeNext(link, back));
  },
  read: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    const { id, back } = await submitted(request);
    if (id) await writeViaApi(locals, user, '/v1/inbox/read', { id });
    redirect(303, back);
  },
  readAll: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    const { back, until } = await submitted(request);
    await writeViaApi(locals, user, '/v1/inbox/readAll', { until });
    redirect(303, back);
  },
};
