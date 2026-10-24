import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { loadInvitation } from '#lib/server/invitations/api.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { invitationAction } from '#lib/server/invitations/actions.js';
import type { PageServerLoad, Actions } from './$types';
export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  if (!z.uuid().safeParse(params.id).success) error(404, 'Not found');
  try {
    return { invitation: await loadInvitation(locals, await locals.getProfile(), params.id) };
  } catch (cause) {
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};
export const actions: Actions = {
  accept: invitationAction('accept'),
  decline: invitationAction('decline'),
  block: invitationAction('block'),
};
