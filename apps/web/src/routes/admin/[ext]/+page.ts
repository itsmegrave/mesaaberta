import { error } from '@sveltejs/kit';
import { panels } from '#lib/extensions/panels.js';
import type { PageLoad } from './$types';

// The panel is a component, so it is loaded here (on the server for the first render, in the
// browser afterwards) and not serialized with the server's data.
export const load: PageLoad = async ({ data, params }) => {
  const panel = Object.hasOwn(panels, params.ext) ? panels[params.ext] : undefined;
  if (!panel) error(404);
  return { ...data, Panel: (await panel()).default };
};
