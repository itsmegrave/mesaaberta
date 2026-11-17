import { loadRead } from '#lib/server/reads/load.js';
import { sourceChannel } from '@mesaaberta/core/server/analytics/track';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'gamemasters');
  const { locals, url, request } = event;
  const { query, system, modality, open } = data.filters;
  locals.track('gm_directory_viewed', (await locals.getUser())?.id, {
    page_context: query ? 'search_results' : system || modality || open ? 'filtered' : 'browse',
    source_channel: sourceChannel(request.headers.get('referer'), url),
    result_count: data.total,
  });
  return data;
};
