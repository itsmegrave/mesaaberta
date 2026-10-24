import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { MAX_PARTNER_LINKS } from '@mesaaberta/core/partners/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { handlePartnerForm } from '#lib/server/partners/form-action.js';

import { findOwnPartner } from '@mesaaberta/core/server/partners/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  try {
    const partner = await findOwnPartner(locals.db, await locals.getProfile(), params.id);
    return {
      id: partner.id,
      logoUrl: partnerLogoUrl(supabaseUrlOf(locals.env), partner.logoPath),
      approved: partner.approvedAt !== null,
      form: initialForm({
        name: partner.name,
        description: partner.description ?? '',
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
  default: async (event) => {
    await requireUser(event.locals, event.url);
    return handlePartnerForm(event, { id: event.params.id });
  },
};
