import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readTables } from '@mesaaberta/core/server/reads/tables';
import { readTableFilters } from '#lib/tables/filters.js';
import type { RequestEvent } from '@sveltejs/kit';
import { readViaApi } from '../api-read';

export const read = async ({ locals, url }: RequestEvent) => {
  // Every filter comes from the query string of the GET form, validated by its schema. Several of
  // each can be ticked: a table matches if it has any of the systems, platforms and tags ticked.
  const filters = await readTableFilters(url);
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) {
    return {
      tables: [],
      systems: [],
      pickedSystems: filters.systems,
      modality: filters.modality,
      catalog: { platforms: [], tags: [], moreTags: [] },
      pickedPlatforms: filters.platforms,
      pickedTags: filters.tags,
    };
  }

  // Through the api Worker when `api_reads_tables` is on for the signed-in person (visitors stay
  // here: a flag needs someone to target); here otherwise. Only the validated filters travel.
  const profile = await locals.getProfile();
  const query = new URLSearchParams();
  for (const slug of filters.systems) query.append('system', slug);
  for (const slug of filters.platforms) query.append('platform', slug);
  for (const slug of filters.tags) query.append('tag', slug);
  if (filters.modality) query.set('modality', filters.modality);
  const remote = profile
    ? await readViaApi<Awaited<ReturnType<typeof readTables>>>(
        locals,
        'api_reads_tables',
        profile,
        `/v1/reads/tables?${query}`,
      )
    : null;
  // JSON turned the two dates into strings; the page gets them as dates either way.
  const answer = remote
    ? {
        ...remote,
        tables: remote.tables.map((table) => ({
          ...table,
          startsAt: new Date(table.startsAt),
          until: table.until ? new Date(table.until) : null,
        })),
      }
    : await readTables(locals.db, filters, new Date());

  return {
    ...answer,
    tables: answer.tables.map(({ imagePath, ...table }) => ({
      ...table,
      imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath),
    })),
  };
};
