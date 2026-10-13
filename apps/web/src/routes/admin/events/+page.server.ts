import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { forceSchema, retryAllSchema } from '$lib/admin/event-filters';
import { validateStringForm } from '$lib/forms/contract';
import { requireAdmin } from '$lib/server/admin-access';
import { eventQueue } from '$lib/server/admin/event-queue';
import { callApi } from '$lib/server/api-client';
import { requireUser } from '$lib/server/auth/guard';
import {
  forceEvent,
  forceFailedEvents,
  type ForceOutcome,
} from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const queue = await eventQueue(
    locals.db,
    await locals.getProfile(),
    handlersFor(locals.env),
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

/** `api_admin_events` for this admin (kill switch: off sends the actions back to this Worker). */
const apiEnabled = ({ locals }: RequestEvent, adminId: string) =>
  locals.flags.isEnabled('api_admin_events', { id: adminId, isAdmin: true });

export const actions: Actions = {
  // "Rodar agora": one event, run at once. The page shows how it went.
  force: async (event) => {
    const { db, adminId } = await admin(event);
    const form = validateStringForm(await event.request.formData(), forceSchema, ['id']);
    if (!form.valid) return fail(400, { form });

    const viaApi = (await apiEnabled(event, adminId))
      ? await callApi<{ outcome: ForceOutcome }>(
          event.locals.env,
          `/v1/admin/events/${encodeURIComponent(form.data.id)}/force`,
          adminId,
          event.locals.log,
        )
      : null;
    if (viaApi) return { form, outcome: viaApi.outcome };

    const outcome = await forceEvent(
      db,
      handlersFor(event.locals.env),
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

    const viaApi = (await apiEnabled(event, adminId))
      ? await callApi<Awaited<ReturnType<typeof forceFailedEvents>>>(
          event.locals.env,
          '/v1/admin/events/retry-failed',
          adminId,
          event.locals.log,
        )
      : null;
    if (viaApi) return { form, ...viaApi };

    const result = await forceFailedEvents(
      db,
      handlersFor(event.locals.env),
      adminId,
      new Date(),
      event.locals.log,
    );
    return { form, ...result };
  },
};
