import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import { tableCalendarEnabled } from '#lib/server/tables/calendar-enabled.js';
import type { CalendarTable } from '@mesaaberta/core/server/calendar/ics';
import { buildCalendar, uidDomainFor } from '@mesaaberta/core/server/calendar/ics';
import type { RequestHandler } from './$types';

// "Adicionar à agenda" › "Apple, Outlook e outros": this one table as an `.ics`, for its GM and
// confirmed players (the api answers anyone else with its 404).
export const GET: RequestHandler = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  if (!(await tableCalendarEnabled(locals, await locals.getProfile()))) error(404, 'Not found');

  const table = await readFromApi<CalendarTable>(
    locals,
    user.id,
    `/v1/table-calendar/${encodeURIComponent(params.slug)}`,
  );

  return new Response(
    buildCalendar({
      // JSON turned the dates into strings.
      tables: [
        {
          ...table,
          startsAt: new Date(table.startsAt),
          until: table.until ? new Date(table.until) : null,
        },
      ],
      baseUrl: url.origin,
      // The same UID as the invite sent by mail, so a calendar app does not show the table twice.
      uidDomain: uidDomainFor(locals.env, url.origin),
    }),
    {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `attachment; filename="${table.slug.replace(/[^a-z0-9-]/gi, '')}.ics"`,
        'cache-control': 'no-store',
      },
    },
  );
};
