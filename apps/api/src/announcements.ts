import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { announcementSchema } from '@mesaaberta/core/notifications/announcement';
import { sendAnnouncement } from '@mesaaberta/core/server/notifications/announcements';
import { refusal } from './refusal';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;

/**
 * The admin console's announcements (Trello #120): `POST /` with the form's own schema. Two steps,
 * as in the console: unconfirmed it answers `{ step: 'confirm', count, recipient }` (who it would
 * reach), confirmed it records the event and answers `{ step: 'sent', count, eventIds }` for the web
 * Worker to dispatch after its response. An audience of nobody, or a recipient who does not exist,
 * is a 400 with the field and code the form shows.
 */
export function announcementRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/', async (c) => {
    const parsed = announcementSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      return c.json({ error: 'invalid', field, message: 'invalid' }, 400);
    }

    try {
      const result = await sendAnnouncement(c.get('db'), c.get('actor'), parsed.data);
      if (result.step === 'confirm')
        return c.json({
          step: 'confirm',
          count: result.count,
          recipient: result.recipient ? { username: result.recipient.username } : null,
        });
      return c.json({ step: 'sent', count: result.count, eventIds: [result.eventId] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
