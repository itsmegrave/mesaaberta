import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import type { CalendarTable } from '@mesaaberta/core/server/calendar/ics';
import { buildCalendar, uidDomainFor } from '@mesaaberta/core/server/calendar/ics';
import type { RequestHandler } from './$types';

// "Baixar calendário" in Minhas mesas: the tables the person runs or has a seat at, as one `.ics`.
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  const now = new Date();
  // The api Worker reads them; JSON turned their dates into strings.
  const tables = (await readFromApi<CalendarTable[]>(locals, user.id, '/v1/me/calendar')).map(
    (table) => ({
      ...table,
      startsAt: new Date(table.startsAt),
      until: table.until ? new Date(table.until) : null,
    }),
  );

  return new Response(
    buildCalendar({
      tables,
      baseUrl: url.origin,
      // The same UIDs as the invites sent by mail, so a calendar app does not show a table twice.
      uidDomain: uidDomainFor(locals.env, url.origin),
      now,
    }),
    {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'attachment; filename="mesa-aberta.ics"',
        'cache-control': 'no-store',
      },
    },
  );
};
