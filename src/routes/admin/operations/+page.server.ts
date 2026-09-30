import { error, fail } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import '$lib/forms/zod-codes';
import { requireAdmin } from '$lib/server/admin-access';
import { listWork, queueHealth, retryEvent } from '$lib/server/admin/operations';
import { requireUser } from '$lib/server/auth/guard';
import { Invalid } from '$lib/server/errors';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import type { Actions, PageServerLoad } from './$types';

z.config({ jitless: true });
const retrySchema = z.object({ id: z.uuid() });

/**
 * Read-only unless the deploy turns retries on (`ADMIN_QUEUE_RETRY=true`): the page is for looking,
 * and a person has to opt in to change the queue from it.
 */
const canRetry = (platform: App.Platform | undefined) =>
  (platform?.env as Record<string, string | undefined> | undefined)?.ADMIN_QUEUE_RETRY === 'true';

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  const [health, work] = await Promise.all([queueHealth(locals.db), listWork(locals.db)]);
  return { health, work, canRetry: canRetry(platform), now: new Date() };
};

export const actions: Actions = {
  retry: async (event) => {
    const { locals, request, url, platform } = event;
    await requireUser(locals, new URL(url.pathname, url));
    await requireAdmin(locals);
    if (!canRetry(platform)) error(404, 'Not found');
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(retrySchema));
    if (!form.valid) return fail(400, { form });
    let eventId: string;
    try {
      eventId = await retryEvent(locals.db, await locals.getProfile(), form.data.id);
    } catch (e) {
      if (e instanceof Invalid) return setError(form, '', e.message, { status: 400 });
      throw e;
    }
    // The retry is recorded; the event it put back is picked up by the next sweep, or now.
    locals.afterResponse(async (db) => {
      await dispatchEvent(db, handlersFor(platform?.env), form.data.id);
      await dispatchEvent(db, handlersFor(platform?.env), eventId);
    });
    return { form };
  },
};
