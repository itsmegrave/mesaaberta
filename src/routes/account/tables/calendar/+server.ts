import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { listCalendarTables } from '$lib/server/calendar/feed';
import { buildCalendar } from '$lib/server/calendar/ics';
import type { RequestHandler } from './$types';

// "Baixar calendário" in Minhas mesas: the tables the person runs or has a seat at, as one `.ics`.
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const now = new Date();
  const tables = await listCalendarTables(locals.db, user.id, now);

  return new Response(buildCalendar({ tables, baseUrl: url.origin, now }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="mesa-aberta.ics"',
      'cache-control': 'no-store',
    },
  });
};
