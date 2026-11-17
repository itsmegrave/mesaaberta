import { fail } from '@sveltejs/kit';
import { validateStringForm, validateFormData } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { blockSchema, messageSchema, muteSchema } from '@mesaaberta/core/messages/schema';
import { messageReportSchema } from '@mesaaberta/core/moderation/reports';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { safetyAllowed } from '#lib/server/messages/safety.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { RateLimited } from '@mesaaberta/core/server/errors';
import { failFrom } from '#lib/server/fail-from.js';
import { loadChatThread } from '#lib/server/messages/thread.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadChatThread(event, event.params.id);

export const actions: Actions = {
  send: async ({ request, locals, url, params, setHeaders }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));

    const form = validateStringForm(await request.formData(), messageSchema, ['body', 'tableId']);
    if (!form.valid) return fail(400, { form });

    try {
      await writeViaApi(locals, user, '/v1/inbox/send', {
        conversationId: params.id,
        body: form.data.body,
        ...(form.data.tableId ? { tableId: form.data.tableId } : {}),
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
    const user = await requireUser(locals, new URL(url.pathname, url));

    const form = validateFormData(
      await request.formData(),
      muteSchema,
      { muted: false },
      { booleans: ['muted'] },
    );
    if (!form.valid) return fail(400, { form });
    try {
      await writeViaApi(locals, user, '/v1/inbox/mute', {
        conversationId: params.id,
        muted: form.data.muted,
      });
    } catch (cause) {
      const failure = failFrom(cause);
      return formMessage(form, { code: failure.data.error }, { status: failure.status });
    }
    return { form };
  },

  // "Bloquear @x" and "Desbloquear" (`use_message_safety`). The events are the invitations a block
  // cancels.
  block: moderationAction(blockSchema, ['profileId', 'blocked'], {
    path: '/v1/messages/block',
    allow: safetyAllowed,
  }),

  // "Denunciar mensagem" and "Denunciar @x" (`use_message_safety`). Admins see it in the queue.
  report: moderationAction(
    messageReportSchema,
    ['targetType', 'messageId', 'profileId', 'reason', 'details'],
    {
      path: (event) => `/v1/messages/${encodeURIComponent(event.params.id!)}/report`,
      allow: safetyAllowed,
    },
  ),
};
