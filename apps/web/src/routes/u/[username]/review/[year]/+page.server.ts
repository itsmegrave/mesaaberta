import { error, fail, redirect } from '@sveltejs/kit';
import { validateStringForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { callApiRaw } from '#lib/server/api-client.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { siteOf } from '@mesaaberta/core/server/site';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { routes } from '@mesaaberta/core/routes';
import { yearReviewShareSchema } from '@mesaaberta/core/profile/year-review-share';
import type { readYearReview } from '@mesaaberta/core/server/profile/year-review';
import type { Actions, PageServerLoad } from './$types';

type Review = NonNullable<Awaited<ReturnType<typeof readYearReview>>>;

/** Whether the Retrospectiva is on for the person reading (`use_year_review`). */
async function reviewEnabled(locals: App.Locals) {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled('use_year_review', profile ? { id: profile.id } : {});
}

// Retrospectiva: a person's year at the tables. Their own, or anyone's they made public; anything
// else (a year with none, someone private) is the same 404.
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!(await reviewEnabled(locals))) error(404, 'Not found');
  const user = await locals.getUser();
  const answer = await callApiRaw(
    locals.env,
    `/v1/year-review/${encodeURIComponent(params.username)}/${encodeURIComponent(params.year)}`,
    user?.id ?? null,
    locals.log,
    undefined,
    {},
    'GET',
  );
  if (answer?.status === 404) error(404, 'Not found');
  if (!answer?.ok) error(503, 'Service unavailable');
  const found = answer.body as Review;
  const path = `${routes.profile(found.person.username)}/review/${found.review.year}`;
  if (params.username !== found.person.username) redirect(308, path);
  const { avatarPath, avatarUrl, ...person } = found.person;
  return {
    ...found,
    person: {
      ...person,
      avatarUrl: pictureOf(supabaseUrlOf(locals.env), { avatarPath, avatarUrl }),
    },
    link: `${siteOf(locals.env, locals.log).APP_ORIGIN}${path}`,
  };
};

export const actions: Actions = {
  // "Deixar pública" / "Deixar só para mim", for the owner.
  share: async ({ locals, params, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    const profile = await locals.getProfile();
    if (!profile || profile.username !== params.username.toLowerCase()) error(403, 'Forbidden');
    if (!(await reviewEnabled(locals))) error(404, 'Not found');
    const form = validateStringForm(await request.formData(), yearReviewShareSchema, ['shared']);
    if (!form.valid) return fail(400, { form });
    await writeViaApi(locals, user, '/v1/year-review/share', {
      shared: form.data.shared === 'true',
    });
    return { form };
  },
};
