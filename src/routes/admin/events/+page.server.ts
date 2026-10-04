import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { forceSchema, retryAllSchema } from '$lib/admin/event-filters';
import { validateStringForm } from '$lib/forms/contract';
import { requireAdmin } from '$lib/server/admin-access';
import { eventQueue } from '$lib/server/admin/event-queue';
import { requireUser } from '$lib/server/auth/guard';
import { forceEvent, forceFailedEvents } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, platform, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const queue = await eventQueue(
    locals.db,
    await locals.getProfile(),
    handlersFor(platform?.env),
    url.searchParams,
  );
  if (!queue) error(404, 'Not found');
  return { queue };
};

/** The guard every action shares: signed in, an admin, with a database. Returns who is acting. */
async function admin({ locals, url }: RequestEvent) {
  await requireUser(locals, new URL(url.pathname, url));
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');
  return { db: locals.db, adminId: profile.id };
}

export const actions: Actions = {
  // "Rodar agora": one event, run at once. The page shows how it went.
  force: async (event) => {
    const { db, adminId } = await admin(event);
    const form = validateStringForm(await event.request.formData(), forceSchema, ['id']);
    if (!form.valid) return fail(400, { form });

    const outcome = await forceEvent(
      db,
      handlersFor(event.platform?.env),
      form.data.id,
      adminId,
      new Date(),
      event.locals.log,
    );
    return { form, outcome };
  },

  // "Rodar todos os que falharam": the given-up events, a bounded batch at a time.
  retryAll: async (event) => {
    const { db, adminId } = await admin(event);
    const form = validateStringForm(await event.request.formData(), retryAllSchema, []);
    if (!form.valid) return fail(400, { form });

    const result = await forceFailedEvents(
      db,
      handlersFor(event.platform?.env),
      adminId,
      new Date(),
      event.locals.log,
    );
    return { form, ...result };
  },
};
