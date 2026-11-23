// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { WidgetStatus } from '@mesaaberta/db/widget-status';

/** What an admin does with a widget. */
export type WidgetEvent = 'PUBLISH' | 'PAUSE' | 'CLOSE';

/**
 * A widget (`widgets`: polls now, popups next). An admin publishes a draft, pauses a live one and
 * publishes it again, and closes a live or paused one for good. The extensions that own a widget
 * kind (in the private package) apply these moves with `applyTransition`.
 */
export const widgetMachine = createMachine({
  types: {} as { events: { type: WidgetEvent } },
  id: 'widget',
  initial: 'draft',
  states: {
    draft: { on: { PUBLISH: 'live' } },
    live: { on: { PAUSE: 'paused', CLOSE: 'closed' } },
    paused: { on: { PUBLISH: 'live', CLOSE: 'closed' } },
    closed: {},
  } satisfies Record<WidgetStatus, object>,
});
