import { error } from '@sveltejs/kit';
import { requireApi } from '#lib/server/api-required.js';
import { revivedDates } from '#lib/server/api-read.js';
import type { CalendarTable } from '@mesaaberta/core/server/calendar/ics';
import { buildCalendar, uidDomainFor } from '@mesaaberta/core/server/calendar/ics';
import { FEED_TOKEN } from '@mesaaberta/core/server/calendar/feed';
import { NotFound } from '@mesaaberta/core/server/errors';
import type { RequestHandler } from './$types';

// The subscribed calendar feed: a calendar app reads it now and then, without signing in, with the
// person's secret in the address. The same events as "Baixar calendário" and the invites by mail
// (one UID per table), plus the sessions of the last weeks so a played one stays in the calendar.
export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!FEED_TOKEN.test(params.token)) error(404, 'Not found');
  let feed: { profileId: string; tables: CalendarTable[] };
  try {
    feed = revivedDates(
      await requireApi<{ profileId: string; tables: CalendarTable[] }>(
        locals,
        null,
        `/v1/calendar-feed/${params.token}`,
      ),
    );
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
  if (!(await locals.flags.isEnabled('use_calendar_feed', { id: feed.profileId })))
    error(404, 'Not found');

  return new Response(
    buildCalendar({
      tables: feed.tables,
      baseUrl: url.origin,
      uidDomain: uidDomainFor(locals.env, url.origin),
    }),
    {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        // Calendar apps poll on their own schedule; a short cache spares the api a burst.
        'cache-control': 'private, max-age=900',
        // The address is a secret: never let a search engine keep it.
        'x-robots-tag': 'noindex',
      },
    },
  );
};
