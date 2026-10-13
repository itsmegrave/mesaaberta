import { loadRead } from '$lib/server/reads/load';
import { sourceChannel } from '$lib/server/analytics/track';
import type { PageServerLoad } from './$types';

const FILTERS = ['system', 'platform', 'tag', 'modality'];

export const load: PageServerLoad = async (event) => {
  const data = await loadRead(event, 'tables');
  const { locals, url, request } = event;
  locals.track('player_browse_mesas_viewed', (await locals.getUser())?.id, {
    page_context: FILTERS.some((name) => url.searchParams.has(name))
      ? 'search_results'
      : 'browse_feed',
    source_channel: sourceChannel(request.headers.get('referer'), url),
    result_count: data.tables.length,
  });
  return data;
};
