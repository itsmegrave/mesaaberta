import { fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { lookingSchema, readPlayerFilters } from '@mesaaberta/core/players/looking';
import type { listLookingPlayers, LookingState } from '@mesaaberta/core/server/players/directory';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { Invalid } from '@mesaaberta/core/server/errors';
import type { Actions, PageServerLoad } from './$types';

type List = NonNullable<Awaited<ReturnType<typeof listLookingPlayers>>> & { me: LookingState };

// Procuro mesa: the people looking for a table, for signed-in people, and their own switch on top.
// A page past the last is the api's 404.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireDirectory(locals, 'players');
  const filters = readPlayerFilters(url.searchParams);
  const { me, ...list } = revivedDates(
    await readFromApi<List>(locals, user.id, `/v1/players?${url.searchParams}`),
  );
  const supabase = supabaseUrlOf(locals.env);
  return {
    filters,
    me,
    form: initialForm({ looking: me.looking, note: me.note }),
    total: list.total,
    pages: list.pages,
    systems: list.systems,
    people: list.people.map(({ avatarPath, avatarUrl, ...person }) => ({
      ...person,
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
  };
};

export const actions: Actions = {
  // "Estou procurando mesa": on (the LOOKING_DAYS start over) with the note, or off.
  looking: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireDirectory(locals, 'players');
    const form = validateFormData(
      await request.formData(),
      lookingSchema,
      { looking: false, note: '' },
      { booleans: ['looking'] },
    );
    if (!form.valid) return fail(400, { form });
    try {
      await writeViaApi(locals, user, '/v1/players/looking', { ...form.data });
    } catch (cause) {
      if (cause instanceof Invalid) {
        form.valid = false;
        form.errors[cause.field === 'note' ? 'note' : '_errors'] = [cause.message];
        return fail(400, { form });
      }
      throw cause;
    }
    return { form };
  },
};
