import { partnerIdSchema, reportPartnerSchema } from '@mesaaberta/core/moderation/reports';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import { can } from '@mesaaberta/core/server/auth/policy';

import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import type { listPartners } from '@mesaaberta/core/server/partners/service';
import { readFromApi } from '#lib/server/api-read.js';
import { directoryLinksEnabled } from '#lib/server/directories/flags.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const filters = readPartnerFilters(url.searchParams);
  const profile = await locals.getProfile();
  // The api reads the page; one past the last is its 404, which becomes the page's.
  const list = await readFromApi<NonNullable<Awaited<ReturnType<typeof listPartners>>>>(
    locals,
    profile?.id ?? null,
    `/v1/partners?${url.searchParams}`,
  );

  const supabase = supabaseUrlOf(locals.env);
  // Who looks after a partner is for admins and those accounts only: the page learns whether the
  // viewer is one of them, and the ids stay on the server.
  const cards = list.cards.map(({ logoPath, ownerIds, ...card }) => ({
    ...card,
    logoUrl: partnerLogoUrl(supabase, logoPath),
    canEdit: !!profile && ownerIds.includes(profile.id),
    // Only a member can report, and not one they look after; a card waiting for review is not.
    canReport: !card.pending && can(profile, 'partner:report', { ownerIds }),
  }));
  return {
    filters,
    cards,
    total: list.total,
    pages: list.pages,
    signedIn: !!profile,
    // Each card links to its partner's own page (`use_directory_links`).
    partnerPages: await directoryLinksEnabled(locals),
    sent: url.searchParams.get('enviado') === '1',
  };
};

export const actions: Actions = {
  // "Denunciar" on a card. The service refuses one's own partner and a repeat while one waits.
  report: moderationAction(reportPartnerSchema, ['id', 'reason', 'details'], {
    path: '/v1/reports/partner',
  }),
  // "Remover…" in the card's menu: only its submitter, and the service checks that again.
  withdraw: moderationAction(partnerIdSchema, ['id'], { path: '/v1/reports/withdrawPartner' }),
};
