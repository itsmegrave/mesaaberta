import { error, fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { signedInHomeEnabled } from '#lib/server/profile/signed-in-home.js';
import { favoriteSystemsSchema } from '@mesaaberta/core/profile/favorite-systems';
import { Invalid } from '@mesaaberta/core/server/errors';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import type { readFavoriteSystems } from '@mesaaberta/core/server/profile/favorite-systems';
import type { listSystems } from '@mesaaberta/core/server/systems';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The signed-in person, when `use_signed_in_home` reaches them; a 404 otherwise. */
async function owner({ locals, url }: Pick<RequestEvent, 'locals' | 'url'>) {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!profile || !(await signedInHomeEnabled(locals, profile))) error(404);
  return profile;
}

// "Sistemas favoritos": the systems the signed-in Início follows, and whether the public profile
// shows them.
export const load: PageServerLoad = async (event) => {
  const profile = await owner(event);
  const { systems, favorites } = await readFromApi<{
    systems: Awaited<ReturnType<typeof listSystems>>;
    favorites: Awaited<ReturnType<typeof readFavoriteSystems>>;
  }>(event.locals, profile.id, '/v1/me/favorite-systems');
  return {
    systems,
    form: initialForm({
      systems: favorites.map((system) => system.slug),
      show: profile.showFavoriteSystems,
    }),
  };
};

export const actions: Actions = {
  save: async (event) => {
    const profile = await owner(event);
    const form = validateFormData(
      await event.request.formData(),
      favoriteSystemsSchema,
      { systems: [], show: false },
      { arrays: ['systems'], booleans: ['show'] },
    );
    if (!form.valid) return fail(400, { form });

    try {
      const { eventIds } = await writeViaApi(
        event.locals,
        profile,
        '/v1/me/favorite-systems',
        form.data,
      );
      for (const id of eventIds)
        event.locals.afterResponse((tx) =>
          dispatchEvent(tx, handlersFor(event.locals.env), id, new Date(), event.locals.log),
        );
    } catch (cause) {
      if (!(cause instanceof Invalid)) throw cause;
      return fail(400, { form: { ...form, valid: false, errors: { systems: [cause.message] } } });
    }
    return { form };
  },
};
