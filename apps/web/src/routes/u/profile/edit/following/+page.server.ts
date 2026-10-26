import { error, fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { followAction } from '#lib/server/follows/action.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { followNoticesSchema } from '@mesaaberta/core/follows/schema';
import {
  followerCount,
  listFollowing,
  setFollowNotices,
} from '@mesaaberta/core/server/follows/service';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The signed-in person, when `use_follows` reaches them; a 404 otherwise. */
async function owner({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const profile = await locals.getProfile();
  if (!profile || !(await followsEnabled(locals, profile))) error(404);
  return { db: locals.db, profile };
}

// "Seguindo": the people this person follows, a page at a time, how many follow them, and the two
// bell switches for what the people they follow do.
export const load: PageServerLoad = async (event) => {
  const { db, profile } = await owner(event);
  const page = pageNumber(event.url.searchParams.get('page'));
  const [following, followers] = await Promise.all([
    listFollowing(db, profile.id, { page, supabaseUrl: supabaseUrlOf(event.locals.env) }),
    followerCount(db, profile.id),
  ]);
  if (page > following.pages) error(404, 'Not found');
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
    const { db, profile } = await owner(event);
    const form = validateFormData(
      await event.request.formData(),
      followNoticesSchema,
      { tables: false, seats: false },
      { booleans: ['tables', 'seats'] },
    );
    if (!form.valid) return fail(400, { form });
    await setFollowNotices(db, profile.id, form.data);
    return { form };
  },
};
