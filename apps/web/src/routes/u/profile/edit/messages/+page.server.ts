import { error, fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { invitationAction } from '#lib/server/invitations/actions.js';
import { invitationPreferences } from '#lib/server/invitations/api.js';
import { directMessagesSchema } from '@mesaaberta/core/messages/schema';
import { setDirectMessages } from '@mesaaberta/core/server/messages/service';
import type { Actions, PageServerLoad } from './$types';

// "Mensagens e convites": direct messages, invitations to tables and the people blocked from them.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  return {
    invitationPreferences: await invitationPreferences(locals, profile),
    messagesForm: initialForm({ enabled: profile?.directMessagesEnabled ?? true }),
  };
};

export const actions: Actions = {
  invitations: invitationAction('preference'),
  invitationBlock: invitationAction('block'),

  // The switch for direct messages: it saves on its own.
  messages: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const messagesForm = validateFormData(
      await request.formData(),
      directMessagesSchema,
      { enabled: false },
      { booleans: ['enabled'] },
    );
    if (!messagesForm.valid) return fail(400, { form: messagesForm });

    const profile = await locals.getProfile();
    const remote = profile
      ? await writeViaApi(locals, 'api_account', profile, '/v1/account/messages', messagesForm.data)
      : null;
    if (!remote) await setDirectMessages(locals.db, user.id, messagesForm.data.enabled);
    return { form: messagesForm };
  },
};
