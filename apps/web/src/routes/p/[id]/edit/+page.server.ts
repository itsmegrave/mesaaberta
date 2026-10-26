import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { MAX_PARTNER_LINKS } from '@mesaaberta/core/partners/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { handlePartnerForm } from '#lib/server/partners/form-action.js';

import { findOwnPartner } from '@mesaaberta/core/server/partners/service';
import {
  partnerInvitationIdSchema,
  partnerInviteSchema,
  partnerOwnerSchema,
} from '@mesaaberta/core/partners/owners';
import {
  cancelPartnerInvitation,
  invitePartnerOwner,
  listPartnerOwners,
  removePartnerOwner,
} from '@mesaaberta/core/server/partners/owners';
import { ownerAction, partnerOwnersEnabled } from '#lib/server/partners/owner-actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  try {
    const profile = await locals.getProfile();
    const partner = await findOwnPartner(locals.db, profile, params.id);
    // "Quem cuida do parceiro", while `use_partner_owners` is on for this person.
    const owners =
      profile && (await partnerOwnersEnabled(locals, profile))
        ? { ...(await listPartnerOwners(locals.db, profile, partner.id)), you: profile.id }
        : null;
    return {
      owners,
      id: partner.id,
      logoUrl: partnerLogoUrl(supabaseUrlOf(locals.env), partner.logoPath),
      approved: partner.approvedAt !== null,
      form: initialForm({
        name: partner.name,
        description: partner.description ?? '',
        types: [...partner.types],
        contactEmail: partner.contactEmail ?? '',
        siteUrl: partner.siteUrl ?? '',
        backlinkUrl: partner.backlinkUrl ?? '',
        couponCode: partner.couponCode ?? '',
        couponDescription: partner.couponDescription ?? '',
        linkNetwork: partner.links
          .slice(0, MAX_PARTNER_LINKS)
          .map((link) => link.network as string),
        linkUrl: partner.links.slice(0, MAX_PARTNER_LINKS).map((link) => link.url),
        logo: undefined,
      }),
    };
  } catch (cause) {
    // Not there, removed, or somebody else's: all the same 404, so the page does not tell them apart.
    if (cause instanceof NotFound || cause instanceof Forbidden) error(404, 'Not found');
    throw cause;
  }
};

export const actions: Actions = {
  save: async (event) => {
    await requireUser(event.locals, event.url);
    return handlePartnerForm(event, { id: event.params.id });
  },
  // "Quem cuida do parceiro": every owner may invite, cancel an invite and take an account off.
  invite: ownerAction(partnerInviteSchema, ['username'], (db, actor, { username }, params) =>
    invitePartnerOwner(db, actor, params.id, username),
  ),
  cancelInvite: ownerAction(partnerInvitationIdSchema, ['invitationId'], (db, actor, data) =>
    cancelPartnerInvitation(db, actor, data.invitationId),
  ),
  // Their own row is "Deixar de cuidar…": they no longer reach this page, so it sends them to /p.
  removeOwner: ownerAction(partnerOwnerSchema, ['profileId'], (db, actor, { profileId }, params) =>
    removePartnerOwner(db, actor, params.id, profileId),
  ),
  leave: ownerAction(
    partnerOwnerSchema,
    ['profileId'],
    (db, actor, _data, params) => removePartnerOwner(db, actor, params.id, actor.id),
    { flagged: false, then: () => '/p' },
  ),
};
