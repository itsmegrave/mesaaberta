import { page } from '$app/state';

/**
 * The zone to show a time in: the viewer's, from the root layout. `fallback` (the table's own zone)
 * is only for a render without the layout, such as a component test. Read it inside `$derived` or
 * the markup so it follows a change.
 */
export const shownTimezone = (fallback: string) => page.data.viewer?.timezone ?? fallback;
