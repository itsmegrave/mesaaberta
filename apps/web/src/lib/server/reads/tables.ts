import { cardPictures } from './card-pictures';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { readTables } from '@mesaaberta/core/server/reads/tables';
import { readTableFilters } from '#lib/tables/filters.js';
import type { RequestEvent } from '@sveltejs/kit';
import { readFromApi } from '../api-read';
import { tableSafetyEnabled } from '../tables/safety-enabled';

export const read = async ({ locals, url }: RequestEvent) => {
  // Every filter comes from the query string of the GET form, validated by its schema. Several of
  // each can be ticked: a table matches if it has any of the systems, platforms and tags ticked.
  const filters = await readTableFilters(url);
  // The api reads the list (visitors too); only the validated filters travel.
  const user = await locals.getUser();
  const query = new URLSearchParams();
  for (const slug of filters.systems) query.append('system', slug);
  for (const slug of filters.platforms) query.append('platform', slug);
  for (const slug of filters.tags) query.append('tag', slug);
  if (filters.modality) query.set('modality', filters.modality);
  if (filters.gm) query.set('gm', filters.gm);
  const remote = await readFromApi<Awaited<ReturnType<typeof readTables>>>(
    locals,
    user?.id ?? null,
    `/v1/reads/tables?${query}`,
  );
  // JSON turned the two dates into strings; the page gets them as dates.
  const answer = {
    ...remote,
    tables: remote.tables.map((table) => ({
      ...table,
      startsAt: new Date(table.startsAt),
      until: table.until ? new Date(table.until) : null,
    })),
  };

  // 18+ tables stay out of the list until the visitor asks for them (`?adult=1`, `use_table_safety`).
  const safety = await tableSafetyEnabled(locals, user ? await locals.getProfile() : null);
  const adultShown = url.searchParams.get('adult') === '1';
  const isAdult = (table: { contentRating?: string | null }) => table.contentRating === '18';
  const adultCount = safety ? answer.tables.filter(isAdult).length : 0;
  const listed =
    safety && !adultShown ? answer.tables.filter((table) => !isAdult(table)) : answer.tables;

  return {
    ...answer,
    tables: listed.map(cardPictures(supabaseUrlOf(locals.env))),
    adult: { count: adultCount, shown: adultShown },
  };
};
