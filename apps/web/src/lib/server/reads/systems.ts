import { error } from '@sveltejs/kit';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { listSystemDirectory } from '@mesaaberta/core/server/systems/directory';
import { readSystemDirectoryFilters } from '@mesaaberta/core/systems/directory-filters';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/** The `/systems` list: one page of approved systems for the filters in the address. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'systems');
  const filters = readSystemDirectoryFilters(url.searchParams);
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) return { filters, systems: [], total: 0, pages: 1 };

  const list = await listSystemDirectory(locals.db, filters, publicReadNow());
  // A page past the last one does not exist.
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(locals.env);
  return {
    filters,
    total: list.total,
    pages: list.pages,
    systems: list.systems.map(({ gms, ...system }) => ({
      ...system,
      gms: gms.map((gm) => ({ username: gm.username, avatarUrl: pictureOf(supabase, gm) })),
    })),
  };
};
