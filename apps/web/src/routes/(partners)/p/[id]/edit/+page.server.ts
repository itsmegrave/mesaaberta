import { error, isHttpError } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { MAX_PARTNER_LINKS } from '@mesaaberta/core/partners/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { handlePartnerForm } from '#lib/server/partners/form-action.js';

import type { findOwnPartner } from '@mesaaberta/core/server/partners/service';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import {
  partnerInvitationIdSchema,
  partnerInviteSchema,
  partnerOwnerSchema,
} from '@mesaaberta/core/partners/owners';
import type { listPartnerOwners } from '@mesaaberta/core/server/partners/owners';
import { ownerAction, partnerOwnersEnabled } from '#lib/server/partners/owner-actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  try {
    const profile = await locals.getProfile();
    // "Quem cuida do parceiro", while `use_partner_owners` is on for this person.
    const withOwners = !!profile && (await partnerOwnersEnabled(locals, profile));
    const { partner, owners: list } = revivedDates(
      await readFromApi<{
        partner: Awaited<ReturnType<typeof findOwnPartner>>;
        owners: Awaited<ReturnType<typeof listPartnerOwners>> | null;
      }>(
        locals,
        user.id,
        `/v1/partners/${encodeURIComponent(params.id)}/edit${withOwners ? '?owners=1' : ''}`,
      ),
    );
    const owners = list && profile ? { ...list, you: profile.id } : null;
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
    if (isHttpError(cause) && (cause.status === 403 || cause.status === 404))
      error(404, 'Not found');
    throw cause;
  }
};

export const actions: Actions = {
  save: async (event) => {
    await requireUser(event.locals, event.url);
    return handlePartnerForm(event, { id: event.params.id });
  },
  // "Quem cuida do parceiro": every owner may invite, cancel an invite and take an account off.
  invite: ownerAction(partnerInviteSchema, ['username'], ({ username }, params) => [
    `/v1/partners/${params.id}/owners/invite`,
    { username },
  ]),
  cancelInvite: ownerAction(partnerInvitationIdSchema, ['invitationId'], (data, params) => [
    `/v1/partners/${params.id}/owners/cancel`,
    { invitationId: data.invitationId },
  ]),
  // Their own row is "Deixar de cuidar…": they no longer reach this page, so it sends them to /p.
  removeOwner: ownerAction(partnerOwnerSchema, ['profileId'], ({ profileId }, params) => [
    `/v1/partners/${params.id}/owners/remove`,
    { profileId },
  ]),
  leave: ownerAction(
    partnerOwnerSchema,
    ['profileId'],
    (_data, params) => [`/v1/partners/${params.id}/owners/leave`, {}],
    { flagged: false, then: () => '/partners' },
  ),
};
