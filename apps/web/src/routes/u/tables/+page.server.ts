import { calendarFeedEnabled } from '#lib/server/calendar-feed.js';
import { loadRead } from '#lib/server/reads/load.js';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async (event) => {
  const [read, user] = await Promise.all([loadRead(event, 'dashboard'), event.locals.getUser()]);
  // "Assinar agenda" shows in the menu only while the feed is on for this person.
  return { ...read, calendarFeed: !!user && (await calendarFeedEnabled(event.locals, user.id)) };
};
