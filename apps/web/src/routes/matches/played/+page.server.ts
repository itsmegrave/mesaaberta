import { requireUser } from '#lib/server/auth/guard.js';
import { playGraphEnabled, requireDirectory } from '#lib/server/directories/flags.js';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export type PlayedItem = {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  tableRole: 'player' | 'gm' | 'both' | null;
  tables: number;
  lastAt: Date;
};
type PlayedList = { total: number; pages: number; items: PlayedItem[] };

// Quem já jogou comigo: everyone the person shared a played table with, latest first, `?page=N`.
// Part of Combinar's graph (`use_play_graph`); a page past the last is the api's 404.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireDirectory(locals, 'matches');
  if (!(await playGraphEnabled(locals))) error(404, 'Not found');
  const page = url.searchParams.get('page');
  const list = await readFromApi<PlayedList>(
    locals,
    user.id,
    `/v1/matches/played${page === null ? '' : `?page=${encodeURIComponent(page)}`}`,
  );
  return { list: revivedDates(list), page: pageNumber(page) };
};
