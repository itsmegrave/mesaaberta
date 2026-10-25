import * as Sentry from '@sentry/sveltekit';
import { error } from '@sveltejs/kit';
import { browser } from '$app/env';
import { observedLoad } from '@mesaaberta/core/server/extensions/observe';
import { panels } from '#lib/extensions/panels.js';
import type { PageLoad } from './$types';

// The panel is a component, so it is loaded here (on the server for the first render, in the
// browser afterwards) and not serialized with the server's data. A panel that does not load is
// followed up: the server logs it (and the logger reports it), the browser reports it itself.
export const load: PageLoad = async ({ data, params }) => {
  const panel = Object.hasOwn(panels, params.ext) ? panels[params.ext] : undefined;
  if (!panel) error(404);
  if (!browser) return { ...data, Panel: (await observedLoad('panel', params.ext, panel)).default };
  try {
    return { ...data, Panel: (await panel()).default };
  } catch (failure) {
    console.error('extension.load_failed', { resourceType: 'panel', resourceId: params.ext });
    Sentry.captureException(failure, { tags: { resourceType: 'panel', resourceId: params.ext } });
    throw failure;
  }
};
