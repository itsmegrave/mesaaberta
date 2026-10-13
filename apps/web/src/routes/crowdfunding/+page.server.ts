import { error } from '@sveltejs/kit';
import { readCrowdfundingFilters } from '@mesaaberta/core/crowdfunding/filters';
import { reportCrowdfundingSchema } from '@mesaaberta/core/moderation/reports';
import { can } from '@mesaaberta/core/server/auth/policy';
import {
  fileCrowdfundingReport,
  listCrowdfundings,
} from '@mesaaberta/core/server/crowdfunding/service';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { moderationAction } from '$lib/server/moderation/form-action';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.db) error(503, 'Database not configured');
  const filters = readCrowdfundingFilters(url.searchParams);
  const list = await listCrowdfundings(locals.db, filters);
  // A page past the last one does not exist.
  if (!list) error(404, 'Not found');

  const profile = await locals.getProfile();
  const supabase = supabaseUrlOf(locals.env);
  // The submitter's id stays on the server: the page needs their handle and whether they may be reported.
  const card = ({ imagePath, submitterId, ...campaign }: (typeof list.running)[number]) => ({
    ...campaign,
    imageUrl: imageUrl(supabase, imagePath),
    // Only a member can report, and not their own: the button is offered only where it would work.
    canReport: can(profile, 'crowdfunding:report', { submitterId }),
  });
  return {
    filters,
    running: list.running.map(card),
    upcoming: list.upcoming.map(card),
    ended: list.ended.map(card),
    endedCount: list.endedCount,
    pages: list.pages,
    signedIn: !!profile,
  };
};

export const actions: Actions = {
  // "Denunciar" on a card. The service refuses one's own campaign and a repeat while one waits.
  report: moderationAction(
    reportCrowdfundingSchema,
    ['id', 'reason', 'details'],
    async (db, actor, { id, reason, details }) =>
      (await fileCrowdfundingReport(db, actor, id, { reason, details })).eventId,
  ),
};
