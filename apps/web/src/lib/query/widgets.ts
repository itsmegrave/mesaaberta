import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';

/** The widgets one page may show, by its route id (see `/api/widgets`). */
export const widgetsKey = (routeId: string | null) => ['widgets', routeId] as const;

export type WidgetsResponse = { widgets: { ext: string; widget: WidgetPayload }[] };
