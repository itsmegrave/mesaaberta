import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { listCalendarTables } from '@mesaaberta/core/server/calendar/feed';
import { buildCalendar, uidDomainFor } from '@mesaaberta/core/server/calendar/ics';
import type { RequestHandler } from './$types';

// "Baixar calendário" in Minhas mesas: the tables the person runs or has a seat at, as one `.ics`.
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const now = new Date();
  const tables = await listCalendarTables(locals.db, user.id, now);

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
