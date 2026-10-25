import { error, redirect } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { notificationActionSchema } from '#lib/notifications/actions.js';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '@mesaaberta/core/notifications/kinds';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '@mesaaberta/core/server/notifications/service';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import type { Actions, PageServerLoad } from './$types';

const categoryOf = (value: string | null): NotificationCategory | undefined =>
  NOTIFICATION_CATEGORIES.find((category) => category === value);

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const profile = await locals.getProfile();
  const withAchievements = profile ? await badgesEnabled(locals, profile) : false;
  const category = categoryOf(url.searchParams.get('category'));
  return {
    category: category ?? null,
    // The "Conquistas" filter and the badge notices wait for the badges to be released.
    withAchievements,
    notifications: await listNotifications(locals.db, user.id, { category, withAchievements }),
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
  ]);
  const id = form.errors.id ? undefined : form.data.id;
  const next = form.errors.next ? null : form.data.next;
  return { id, back: safeNext(next, '/n') };
}

// Plain POST works without JavaScript. The anonymous visitor goes to log in first.
export const actions: Actions = {
  /** Opens a notification: marks it read and follows its link, or comes back when it has none. */
  open: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { id, back } = await submitted(request);
    const profile = await locals.getProfile();
    const remote =
      id && profile
        ? await writeViaApi(locals, 'api_inbox', profile, '/v1/inbox/open', { id })
        : null;
    const link = remote
      ? typeof remote.body.link === 'string'
        ? remote.body.link
        : null
      : id
        ? ((await markRead(locals.db, user.id, id))?.link ?? null)
        : null;
    redirect(303, safeNext(link, back));
  },
  read: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { id, back } = await submitted(request);
    const profile = await locals.getProfile();
    const remote =
      id && profile
        ? await writeViaApi(locals, 'api_inbox', profile, '/v1/inbox/read', { id })
        : null;
    if (id && !remote) await markRead(locals.db, user.id, id);
    redirect(303, back);
  },
  readAll: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { back } = await submitted(request);
    const profile = await locals.getProfile();
    const remote = profile
      ? await writeViaApi(locals, 'api_inbox', profile, '/v1/inbox/readAll', {})
      : null;
    if (!remote) await markAllRead(locals.db, user.id);
    redirect(303, back);
  },
};
