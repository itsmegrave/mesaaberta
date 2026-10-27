import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { listSystemDirectory } from '@mesaaberta/core/server/systems/directory';
import { readFromApi } from '../api-read';
import { readSystemDirectoryFilters } from '@mesaaberta/core/systems/directory-filters';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/** The `/systems` list: one page of approved systems for the filters in the address. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'systems');
  const filters = readSystemDirectoryFilters(url.searchParams);
  // The api reads the page; one past the last is its 404, which becomes the page's.
  const list = await readFromApi<NonNullable<Awaited<ReturnType<typeof listSystemDirectory>>>>(
    locals,
    (await locals.getUser())?.id ?? null,
    `/v1/reads/systems?${url.searchParams}`,
  );
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
