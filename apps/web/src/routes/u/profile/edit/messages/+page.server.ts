import { fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { invitationAction } from '#lib/server/invitations/actions.js';
import { invitationPreferences } from '#lib/server/invitations/api.js';
import { directMessagesSchema } from '@mesaaberta/core/messages/schema';
import { blockSchema } from '@mesaaberta/core/messages/schema';
import { readBlocked } from '#lib/server/messages/api.js';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { withPictures } from '@mesaaberta/core/server/messages/present';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import { messageSafetyEnabled, safetyAllowed } from '#lib/server/messages/safety.js';
import type { Actions, PageServerLoad } from './$types';

// "Mensagens e convites": direct messages, the people this person blocked (`use_message_safety`),
// invitations to tables and the people blocked from them.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  const blocked =
    profile && (await messageSafetyEnabled(locals, profile))
      ? withPictures(supabaseUrlOf(locals.env), await readBlocked(locals, profile.id))
      : null;
  return {
    invitationPreferences: await invitationPreferences(locals, profile),
    messagesForm: initialForm({ enabled: profile?.directMessagesEnabled ?? true }),
    blocked,
  };
};

export const actions: Actions = {
  invitations: invitationAction('preference'),
  invitationBlock: invitationAction('block'),

  // "Desbloquear" in "Pessoas bloqueadas" (`use_message_safety`).
  block: moderationAction(blockSchema, ['profileId', 'blocked'], {
    path: '/v1/messages/block',
    allow: safetyAllowed,
  }),

  // The switch for direct messages: it saves on its own.
  messages: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);

    const messagesForm = validateFormData(
      await request.formData(),
      directMessagesSchema,
      { enabled: false },
      { booleans: ['enabled'] },
    );
    if (!messagesForm.valid) return fail(400, { form: messagesForm });

    await writeViaApi(locals, user, '/v1/account/messages', messagesForm.data);
    return { form: messagesForm };
  },
};
