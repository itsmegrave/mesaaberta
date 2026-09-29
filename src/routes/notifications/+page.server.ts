import { error, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { notificationActionSchema } from '$lib/notifications/actions';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '$lib/notifications/kinds';
import { requireUser } from '$lib/server/auth/guard';
import { safeNext } from '$lib/server/auth/safe-next';
import { listNotifications, markAllRead, markRead } from '$lib/server/notifications/service';
import type { Actions, PageServerLoad } from './$types';

const categoryOf = (value: string | null): NotificationCategory | undefined =>
  NOTIFICATION_CATEGORIES.find((category) => category === value);

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const category = categoryOf(url.searchParams.get('category'));
  return {
    category: category ?? null,
    notifications: await listNotifications(locals.db, user.id, { category }),
  };
};

/**
 * What the form sent: a field that fails the schema is dropped, so a bad id marks nothing and a bad
 * `next` falls back to the feed. Back is always on the site (the bell is on every page).
 */
async function submitted(request: Request) {
  const form = await superValidate(request, zod4(notificationActionSchema));
  const id = form.errors.id ? undefined : form.data.id;
  const next = form.errors.next ? null : form.data.next;
  return { id, back: safeNext(next, '/notifications') };
}

// Superforms posts that also work as plain ones, so the bell works without JavaScript. The anonymous visitor goes to log in first.
export const actions: Actions = {
  /** Opens a notification: marks it read and follows its link, or comes back when it has none. */
  open: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { id, back } = await submitted(request);
    const read = id ? await markRead(locals.db, user.id, id) : null;
    redirect(303, safeNext(read?.link, back));
  },
  read: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { id, back } = await submitted(request);
    if (id) await markRead(locals.db, user.id, id);
    redirect(303, back);
  },
  readAll: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const { back } = await submitted(request);
    await markAllRead(locals.db, user.id);
    redirect(303, back);
  },
};
