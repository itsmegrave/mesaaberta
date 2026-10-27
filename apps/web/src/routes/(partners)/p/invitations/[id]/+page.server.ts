import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { ownerAction } from '#lib/server/partners/owner-actions.js';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { orderedTypes } from '@mesaaberta/core/partners/types';
import type { loadPartnerInvitation } from '@mesaaberta/core/server/partners/owners';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import type { Actions, PageServerLoad } from './$types';

// The invite to look after a partner, for the person invited only: anyone else gets a 404. It works
// whatever `use_partner_owners` says, so an invite that was sent can always be answered.
export const load: PageServerLoad = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  if (!z.uuid().safeParse(params.id).success) error(404, 'Not found');
  // The api answers it for the invited person only: a 403 or 404 for anyone else.
  const invitation = revivedDates(
    await readFromApi<Awaited<ReturnType<typeof loadPartnerInvitation>>>(
      locals,
      user.id,
      `/v1/partners/invitations/${params.id}`,
    ),
  );
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
};

const answer = (decision: 'accept' | 'decline') =>
  ownerAction(
    z.object({}),
    [],
    (_data, params) => [`/v1/partners/invitations/${params.id}/${decision}`, {}],
    { flagged: false },
  );

export const actions: Actions = {
  accept: answer('accept'),
  decline: answer('decline'),
};
