import { readCrowdfundingFilters } from '@mesaaberta/core/crowdfunding/filters';
import { reportCrowdfundingSchema } from '@mesaaberta/core/moderation/reports';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { listCrowdfundings } from '@mesaaberta/core/server/crowdfunding/service';
import { readFromApi } from '#lib/server/api-read.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { moderationAction } from '#lib/server/moderation/form-action.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const filters = readCrowdfundingFilters(url.searchParams);
  const profile = await locals.getProfile();
  // The api reads the page; one past the last is its 404, which becomes the page's.
  const list = await readFromApi<NonNullable<Awaited<ReturnType<typeof listCrowdfundings>>>>(
    locals,
    profile?.id ?? null,
    `/v1/crowdfundings?${url.searchParams}`,
  );

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
  report: moderationAction(reportCrowdfundingSchema, ['id', 'reason', 'details'], {
    path: '/v1/reports/crowdfunding',
  }),
};
