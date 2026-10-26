import { loadRead } from '#lib/server/reads/load.js';
import { sourceChannel } from '@mesaaberta/core/server/analytics/track';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'places');
  const { locals, url, request } = event;
  const { query, state, kind, amenities } = data.filters;
  locals.track('places_directory_viewed', (await locals.getUser())?.id, {
    page_context: query
      ? 'search_results'
      : state || kind || amenities.length > 0
        ? 'filtered'
        : 'browse',
    source_channel: sourceChannel(request.headers.get('referer'), url),
    result_count: data.total,
  });
  return data;
};
