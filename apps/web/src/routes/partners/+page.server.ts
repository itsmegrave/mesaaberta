import { error } from '@sveltejs/kit';
import { partnerIdSchema, reportPartnerSchema } from '@mesaaberta/core/moderation/reports';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import { can } from '@mesaaberta/core/server/auth/policy';

import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import {
  filePartnerReport,
  listPartners,
  withdrawPartner,
} from '@mesaaberta/core/server/partners/service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.db) error(503, 'Database not configured');
  const filters = readPartnerFilters(url.searchParams);
  const profile = await locals.getProfile();
  const list = await listPartners(locals.db, filters, { viewerId: profile?.id ?? null });
  // A page past the last one does not exist.
  if (!list) error(404, 'Not found');

  const supabase = supabaseUrlOf(locals.env);
  // Who sent a partner is for admins only: the page learns whether the viewer is that person, and
  // the submitter's id stays on the server.
  const cards = list.cards.map(({ logoPath, submitterId, ...card }) => ({
    ...card,
    logoUrl: partnerLogoUrl(supabase, logoPath),
    canEdit: !!profile && profile.id === submitterId,
    // Only a member can report, and not their own; a card that waits for review is not reported.
    canReport: !card.pending && can(profile, 'partner:report', { submitterId }),
  }));
  return {
    filters,
    cards,
    total: list.total,
    pages: list.pages,
    signedIn: !!profile,
    sent: url.searchParams.get('enviado') === '1',
  };
};

export const actions: Actions = {
  // "Denunciar" on a card. The service refuses one's own partner and a repeat while one waits.
  report: moderationAction(
    reportPartnerSchema,
    ['id', 'reason', 'details'],
    async (db, actor, { id, reason, details }) =>
      (await filePartnerReport(db, actor, id, { reason, details })).eventId,
    { player: { path: '/v1/reports/partner' } },
  ),
  // "Remover…" in the card's menu: only its submitter, and the service checks that again.
  withdraw: moderationAction(
    partnerIdSchema,
    ['id'],
    (db, actor, { id }) => withdrawPartner(db, actor, id),
    { player: { path: '/v1/reports/withdrawPartner' } },
  ),
};
