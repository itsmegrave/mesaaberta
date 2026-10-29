import { error, isHttpError } from '@sveltejs/kit';
import { reportPartnerSchema } from '@mesaaberta/core/moderation/reports';
import { can } from '@mesaaberta/core/server/auth/policy';
import { imageUrl, partnerLogoUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { PartnerConnections } from '@mesaaberta/core/server/directories/links';
import type { PartnerCard } from '@mesaaberta/core/server/partners/service';
import { readFromApi } from '#lib/server/api-read.js';
import { directoryLinksEnabled } from '#lib/server/directories/flags.js';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * A partner's own page (`use_directory_links`): what its card shows, with room for more. One
 * waiting for review opens only for those who look after it; anything else is a 404.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
  if (!(await directoryLinksEnabled(locals))) error(404, 'Not found');
  const profile = await locals.getProfile();
  const found = await readFromApi<PartnerCard & PartnerConnections>(
    locals,
    profile?.id ?? null,
    `/v1/partners/${encodeURIComponent(params.id)}`,
  ).catch((cause) => {
    if (isHttpError(cause) && cause.status === 404) error(404, 'Not found');
    throw cause;
  });
  // Who looks after it stays on the server: the page learns only what the viewer may do.
  const { logoPath, ownerIds, places, gms, ...partner } = found;
  const supabase = supabaseUrlOf(locals.env);
  return {
    partner: { ...partner, logoUrl: partnerLogoUrl(supabase, logoPath) },
    // Its places ("Onde jogar") and who looks after it and mestra ("Quem mestra").
    places: places.map(({ imagePath, ...place }) => ({
      ...place,
      imageUrl: imageUrl(supabase, imagePath),
    })),
    gms: gms.map(({ avatarPath, avatarUrl, partnerId: _partnerId, ...gm }) => ({
      ...gm,
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
    canEdit: !!profile && ownerIds.includes(profile.id),
    // A visitor is offered "Denunciar" too, through the login.
    canReport: !partner.pending && (!profile || can(profile, 'partner:report', { ownerIds })),
    signedIn: !!profile,
  };
};

export const actions: Actions = {
  // "Denunciar parceiro". The service refuses one's own partner and a repeat while one waits.
  report: async (event) => {
    if (!(await directoryLinksEnabled(event.locals))) error(404, 'Not found');
    return reportAction(event);
  },
};

const reportAction = moderationAction(reportPartnerSchema, ['id', 'reason', 'details'], {
  path: '/v1/reports/partner',
});
