import * as Sentry from '@sentry/sveltekit';
import { browser } from '$app/env';
import { observedLoad } from '@mesaaberta/core/server/extensions/observe-load';
import { widgets } from './panels.js';
import type { WidgetComponent } from './widget-types.js';

/**
 * The component of a widget kind, loaded the way the admin panels are: on the server the load is
 * logged (and a failure reported by the logger); in the browser a failure is reported here. Either
 * way it is rethrown, and the caller shows nothing for that widget.
 */
export async function loadWidget(kind: string): Promise<WidgetComponent> {
  const load = widgets[kind];
  if (!browser) return (await observedLoad('widget', kind, load)).default;
  try {
    return (await load()).default;
  } catch (failure) {
    console.error('extension.load_failed', { resourceType: 'widget', resourceId: kind });
    Sentry.captureException(failure, { tags: { resourceType: 'widget', resourceId: kind } });
    throw failure;
  }
}
