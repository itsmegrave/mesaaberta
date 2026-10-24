import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { failFrom } from '#lib/server/fail-from.js';
import { openDirectConversation } from '#lib/server/messages/open-direct.js';
import { loadRead } from '#lib/server/reads/load.js';
import { endActions } from '#lib/server/tables/end-actions.js';
import { confirmationActions } from '#lib/server/tables/confirmation-actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadRead(event, 'manage');

export const actions: Actions = {
  // The answer to "did the session happen?" once its date has passed.
  ...confirmationActions,
  ...endActions,

  // "Mandar mensagem" on a player's row: the direct conversation with them. `directBlocker` lets a
  // GM write only to someone with a request or a seat at one of their tables.
  message: async ({ locals, url, request }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const profile = await locals.getProfile();
    const playerId = String((await request.formData()).get('playerId') ?? '');
    try {
      const conversationId = await openDirectConversation(locals, profile, playerId);
      redirect(303, `/messages/${conversationId}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
