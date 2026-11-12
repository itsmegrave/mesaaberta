import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { failFrom } from '#lib/server/fail-from.js';
import type { MatchList } from '@mesaaberta/core/server/matches/service';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';

// Minhas combinações: everyone both sides said yes to, newest first, `?page=N`. A page past the
// last is the api's 404, which becomes the page's.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireDirectory(locals, 'matches');
  const page = url.searchParams.get('page');
  const list = await readFromApi<MatchList>(
    locals,
    user.id,
    `/v1/matches${page === null ? '' : `?page=${encodeURIComponent(page)}`}`,
  );
  const current = pageNumber(page);
  return { list: revivedDates(list), page: current };
};

const endSchema = z.object({ id: z.uuid() });

export const actions: Actions = {
  // Desfazer combinação: for good, by either of the two. Neither is told.
  end: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireDirectory(locals, 'matches');
    const parsed = endSchema.safeParse({ id: (await request.formData()).get('id') });
    if (!parsed.success) return fail(400, { error: 'invalid' as const });
    try {
      await writeViaApi(locals, user, `/v1/matches/${parsed.data.id}/end`, {});
      return { ended: true };
    } catch (cause) {
      return failFrom(cause);
    }
  },
};
