import { error, fail } from '@sveltejs/kit';
import { validateStringForm, validateFormData } from '$lib/forms/contract';
import { formMessage } from '$lib/forms/server';
import { messageSchema, muteSchema } from '@mesaaberta/core/messages/schema';
import { requireUser } from '$lib/server/auth/guard';
import { writeViaApi } from '$lib/server/api-write';
import { RateLimited } from '@mesaaberta/core/server/errors';
import { failFrom } from '$lib/server/fail-from';
import { sendMessage, setMuted } from '@mesaaberta/core/server/messages/service';
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
      const profile = await locals.getProfile();
      // Through the api Worker when `api_inbox` is on for this person; here otherwise.
      const remote = profile
        ? await writeViaApi(locals, 'api_inbox', profile, '/v1/inbox/send', {
            conversationId: params.id,
            body: form.data.body,
            ...(form.data.tableId ? { tableId: form.data.tableId } : {}),
          })
        : null;
      if (!remote)
        await sendMessage(locals.db, profile, params.id, form.data.body, {
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
      const profile = await locals.getProfile();
      const remote = profile
        ? await writeViaApi(locals, 'api_inbox', profile, '/v1/inbox/mute', {
            conversationId: params.id,
            muted: form.data.muted,
          })
        : null;
      if (!remote) await setMuted(locals.db, profile, params.id, form.data.muted);
    } catch (cause) {
      const failure = failFrom(cause);
      return formMessage(form, { code: failure.data.error }, { status: failure.status });
    }
    return { form };
  },
};
