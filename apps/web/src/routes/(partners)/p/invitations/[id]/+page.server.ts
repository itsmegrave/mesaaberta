import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { ownerAction } from '#lib/server/partners/owner-actions.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { orderedTypes } from '@mesaaberta/core/partners/types';
import {
  loadPartnerInvitation,
  respondToPartnerInvitation,
} from '@mesaaberta/core/server/partners/owners';
import type { Actions, PageServerLoad } from './$types';

// The invite to look after a partner, for the person invited only: anyone else gets a 404. It works
// whatever `use_partner_owners` says, so an invite that was sent can always be answered.
export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  if (!z.uuid().safeParse(params.id).success) error(404, 'Not found');
  try {
    const invitation = await loadPartnerInvitation(locals.db, await locals.getProfile(), params.id);
    const { logoPath, ...partner } = invitation.partner;
    return {
      invitation: {
        ...invitation,
        partner: {
          ...partner,
          types: orderedTypes(partner.types),
          logoUrl: partnerLogoUrl(supabaseUrlOf(locals.env), logoPath),
        },
      },
    };
  } catch (cause) {
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};

const answer = (decision: 'accept' | 'decline') =>
  ownerAction(
    z.object({}),
    [],
    (db, actor, _data, params) => respondToPartnerInvitation(db, actor, params.id, decision),
    { flagged: false },
  );

export const actions: Actions = {
  accept: answer('accept'),
  decline: answer('decline'),
};
