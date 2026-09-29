import { error, redirect } from '@sveltejs/kit';
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

/** The form's id field, when there is one. */
const idFrom = (form: FormData) => {
  const id = form.get('id');
  return typeof id === 'string' && id.length > 0 ? id : null;
};

/** Back to where the form was (the bell is on every page), never off the site. */
const back = (form: FormData) => {
  const next = form.get('next');
  return safeNext(typeof next === 'string' ? next : null, '/notifications');
};

// Plain form posts, so the bell works without JavaScript. The anonymous visitor goes to log in first.
export const actions: Actions = {
  /** Opens a notification: marks it read and follows its link, or comes back when it has none. */
  open: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const form = await request.formData();
    const id = idFrom(form);
    const read = id ? await markRead(locals.db, user.id, id) : null;
    redirect(303, safeNext(read?.link, back(form)));
  },
  read: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const form = await request.formData();
    const id = idFrom(form);
    if (id) await markRead(locals.db, user.id, id);
    redirect(303, back(form));
  },
  readAll: async ({ locals, url, request }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const form = await request.formData();
    await markAllRead(locals.db, user.id);
    redirect(303, back(form));
  },
};
