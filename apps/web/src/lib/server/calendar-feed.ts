import { error } from '@sveltejs/kit';

/** Whether the subscribed calendar feed is on for the person (`use_calendar_feed`), by their id. */
export const calendarFeedEnabled = (locals: Pick<App.Locals, 'flags'>, profileId: string) =>
  locals.flags.isEnabled('use_calendar_feed', { id: profileId });

/** The feed page and its actions are a 404 while `use_calendar_feed` is off for the person. */
export async function requireCalendarFeed(locals: Pick<App.Locals, 'flags'>, profileId: string) {
  if (!(await calendarFeedEnabled(locals, profileId))) error(404, 'Not found');
}
