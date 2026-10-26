import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { gmDirectorySystems, listGmDirectory } from '@mesaaberta/core/server/gms/directory';
import { readGmDirectoryFilters } from '@mesaaberta/core/gms/directory-filters';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/** The `/gamemasters` list (Quem mestra): one page of people who run games, for the address's filters. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'gms');
  const filters = readGmDirectoryFilters(url.searchParams);
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) return { filters, people: [], total: 0, pages: 1, systems: [] };

  const profile = await locals.getProfile();
  const showBadges = await locals.flags.isEnabled(
    'use_badges',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
  const [list, systems] = await Promise.all([
    listGmDirectory(locals.db, filters, publicReadNow(), { showBadges }),
    gmDirectorySystems(locals.db),
  ]);
  // A page past the last one does not exist.
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(locals.env);
  return {
    filters,
    total: list.total,
    pages: list.pages,
    systems,
    people: list.people.map(({ avatarPath, avatarUrl, ...person }) => ({
      ...person,
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
  };
};
