import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { profiles } from '@mesaaberta/db/schema';
import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import {
  connectionStringFrom,
  createDb,
  type AnyDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';

/** The header the web Worker sets, over the Service Binding, with the signed-in admin's id. */
export const ACTOR_HEADER = 'x-actor-id';

export type AdminVariables = { db: AnyDb; actorId: string; actor: Actor };
type Open = typeof createDb;

/**
 * The gate every admin route goes through. The Service Binding is the only way in, but the actor is
 * still checked against the database: the api never trusts a header to say someone is an admin. It
 * opens the connection for the request and closes it afterwards.
 */
export const adminGuard = (open: Open) =>
  createMiddleware<{ Bindings: DatabaseEnv; Variables: AdminVariables }>(async (c, next) => {
    const actorId = c.req.header(ACTOR_HEADER);
    const connectionString = connectionStringFrom(c.env);
    if (!actorId) return c.json({ error: 'unauthorized' }, 401);
    if (!connectionString) return c.json({ error: 'unavailable' }, 503);

    const { db, close } = open(connectionString);
    try {
      const [actor] = await db
        .select({ id: profiles.id, role: profiles.role, status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, actorId));
      if (!actor || !can(actor, 'admin:access')) return c.json({ error: 'forbidden' }, 403);
      c.set('db', db as AnyDb);
      c.set('actorId', actorId);
      c.set('actor', actor);
      await next();
    } finally {
      await close().catch(() => undefined);
    }
  });
