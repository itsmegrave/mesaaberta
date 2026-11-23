// Where a widget (a poll, a popup) stands: written as a draft, live for its audience, paused, or
// closed for good.
export const WIDGET_STATUSES = ['draft', 'live', 'paused', 'closed'] as const;
export type WidgetStatus = (typeof WIDGET_STATUSES)[number];
