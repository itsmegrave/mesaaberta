import { loadWidget } from '#lib/extensions/load-widget.js';
import type { PageLoad } from './$types';

// The component is loaded here, not serialized with the server's data, so the page renders on the
// server too. A component that does not load is logged and reported (see `loadWidget`).
export const load: PageLoad = async ({ data }) => ({
  ...data,
  Widget: await loadWidget(data.widget.kind),
});
