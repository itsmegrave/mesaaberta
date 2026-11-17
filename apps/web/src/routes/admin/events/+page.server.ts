import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { forceSchema, retryAllSchema, reviewSchema } from '#lib/admin/event-filters.js';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import type { eventQueue, reviewEvent } from '#lib/server/admin/event-queue.js';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { queueBacklog, type QueueBinding } from '@mesaaberta/events';
import { requireApi } from '#lib/server/api-required.js';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { requireUser } from '#lib/server/auth/guard.js';
import type { forceFailedEvents, ForceOutcome } from '@mesaaberta/core/server/events/dispatcher';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const queue = revivedDates(
    await readFromApi<NonNullable<Awaited<ReturnType<typeof eventQueue>>>>(
      locals,
      user.id,
      `/v1/admin/events?${url.searchParams}`,
    ),
  );
  // The web Worker holds the producer binding; a deploy without it, or one that cannot report, shows no panel.
  const backlog = await queueBacklog(
    (locals.env as { DOMAIN_EVENTS?: QueueBinding } | undefined)?.DOMAIN_EVENTS,
  );
  return { queue, backlog };
};

/** The guard every action shares: signed in and an admin. Returns who is acting. */
async function admin({ locals, url }: RequestEvent) {
  await requireUser(locals, new URL(url.pathname, url));
  await requireAdmin(locals);
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');
  return profile;
}

/** One admin action on the queue, made by the api Worker (`/v1/admin/events/...`). */
const run = <T>(event: RequestEvent, actor: Actor, path: string) =>
  requireApi<T>(event.locals, actor, `/v1/admin/events/${path}`, { method: 'POST' });

export const actions: Actions = {
  // "Rodar agora": one event, run at once. The page shows how it went.
  force: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), forceSchema, ['id']);
    if (!form.valid) return fail(400, { form });

    const { outcome } = await run<{ outcome: ForceOutcome }>(
      event,
      actor,
      `${encodeURIComponent(form.data.id)}/force`,
    );
    return { form, outcome };
  },

  // "Visto", "Ignorar", "Corrigido": an admin's word on a given-up event, with who and when.
  review: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), reviewSchema, ['id', 'review']);
    if (!form.valid) return fail(400, { form });

    const { outcome } = await run<{ outcome: Awaited<ReturnType<typeof reviewEvent>> }>(
      event,
      actor,
      `${encodeURIComponent(form.data.id)}/review/${form.data.review}`,
    );
    return { form, outcome };
  },

  // "Rodar todos os que falharam": the given-up events, a bounded batch at a time.
  retryAll: async (event) => {
    const actor = await admin(event);
    const form = validateStringForm(await event.request.formData(), retryAllSchema, []);
    if (!form.valid) return fail(400, { form });

    const result = await run<Awaited<ReturnType<typeof forceFailedEvents>>>(
      event,
      actor,
      'retry-failed',
    );
    return { form, ...result };
  },
};
