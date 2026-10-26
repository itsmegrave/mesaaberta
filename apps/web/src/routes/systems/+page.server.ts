import { loadRead } from '#lib/server/reads/load.js';
import { sourceChannel } from '@mesaaberta/core/server/analytics/track';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'systems');
  const { locals, url, request } = event;
  locals.track('systems_directory_viewed', (await locals.getUser())?.id, {
    page_context: data.filters.query ? 'search_results' : 'browse',
    source_channel: sourceChannel(request.headers.get('referer'), url),
    result_count: data.total,
  });
  return data;
};
