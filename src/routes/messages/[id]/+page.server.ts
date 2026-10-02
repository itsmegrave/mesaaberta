import { error, fail } from '@sveltejs/kit';
import { validateStringForm, validateFormData } from '$lib/forms/contract';
import { formMessage } from '$lib/forms/server';
import { messageSchema, muteSchema } from '$lib/messages/schema';
import { requireUser } from '$lib/server/auth/guard';
import { RateLimited, failFrom } from '$lib/server/errors';
import { sendMessage, setMuted } from '$lib/server/messages/service';
import { loadChatThread } from '$lib/server/messages/thread';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadChatThread(event, event.params.id);

export const actions: Actions = {
  send: async ({ request, locals, url, params, setHeaders }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = validateStringForm(await request.formData(), messageSchema, ['body', 'tableId']);
    if (!form.valid) return fail(400, { form });

    try {
      await sendMessage(locals.db, await locals.getProfile(), params.id, form.data.body, {
        tableId: form.data.tableId ?? null,
      });
    } catch (cause) {
      if (cause instanceof RateLimited) {
        setHeaders({ 'Retry-After': String(cause.retryAfterSeconds) });
      }
      const failure = failFrom(cause);
      return formMessage(form, { code: failure.data.error }, { status: failure.status });
    }
    // The body is cleared for the next message; the thread refreshes itself.
    return formMessage({ ...form, data: { ...form.data, body: '' } }, { code: 'sent' });
  },

  mute: async ({ request, locals, url, params }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');

    const form = validateFormData(
      await request.formData(),
      muteSchema,
      { muted: false },
      { booleans: ['muted'] },
    );
    if (!form.valid) return fail(400, { form });
    try {
      await setMuted(locals.db, await locals.getProfile(), params.id, form.data.muted);
    } catch (cause) {
      const failure = failFrom(cause);
      return formMessage(form, { code: failure.data.error }, { status: failure.status });
    }
    return { form };
  },
};
