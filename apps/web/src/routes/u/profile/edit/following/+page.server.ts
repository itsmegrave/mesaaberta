import { error, fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { followAction } from '#lib/server/follows/action.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { followNoticesSchema } from '@mesaaberta/core/follows/schema';
import type { followerCount, listFollowing } from '@mesaaberta/core/server/follows/service';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The signed-in person, when `use_follows` reaches them; a 404 otherwise. */
async function owner({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!profile || !(await followsEnabled(locals, profile))) error(404);
  return profile;
}

// "Seguindo": the people this person follows, a page at a time, how many follow them, and the two
// bell switches for what the people they follow do.
export const load: PageServerLoad = async (event) => {
  const profile = await owner(event);
  // A page past the last is the api's 404, which becomes the page's.
  const page = pageNumber(event.url.searchParams.get('page'));
  const { following, followers } = await readFromApi<{
    following: Awaited<ReturnType<typeof listFollowing>>;
    followers: Awaited<ReturnType<typeof followerCount>>;
  }>(event.locals, profile.id, `/v1/follows?page=${page}`);
  return {
    following,
    followers,
    noticesForm: initialForm({
      tables: profile.followNotifyTables,
      seats: profile.followNotifySeats,
    }),
  };
};

export const actions: Actions = {
  // "Deixar de seguir" on a row.
  follow: followAction,

  // "Salvar avisos".
  notices: async (event) => {
    const profile = await owner(event);
    const form = validateFormData(
      await event.request.formData(),
      followNoticesSchema,
      { tables: false, seats: false },
      { booleans: ['tables', 'seats'] },
    );
    if (!form.valid) return fail(400, { form });
    await writeViaApi(event.locals, profile, '/v1/follows/notices', form.data);
    return { form };
  },
};
