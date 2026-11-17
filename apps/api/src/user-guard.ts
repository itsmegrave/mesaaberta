import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { profiles } from '@mesaaberta/db/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  connectionStringFrom,
  createDb,
  type AnyDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { ACTOR_HEADER } from './admin-guard';

export type UserVariables = { db: AnyDb; actorId: string; actor: Actor };
type Open = typeof createDb;

/**
 * The gate for routes any signed-in player may call. Like `adminGuard`, the header is only a claim:
 * the actor is read from the database (role and status), and the service the route runs
 * authorizes what that actor may do, so a banned or suspended account is refused there, exactly as
 * in the web Worker.
 */
export const userGuard = (open: Open) =>
  createMiddleware<{ Bindings: DatabaseEnv; Variables: UserVariables }>(async (c, next) => {
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
      if (!actor) return c.json({ error: 'forbidden' }, 403);
      c.set('db', db as AnyDb);
      c.set('actorId', actorId);
      c.set('actor', actor);
      await next();
    } finally {
      await close().catch(() => undefined);
    }
  });

export type ViewerVariables = { db: AnyDb; actor: Actor | null };

/**
 * The gate for reads anyone may see (the home preview, the table list, a table's page): the actor
 * header is optional. When it names an account, that account is read from the database like in
 * `userGuard`; no header, or an account that has no profile yet, reads as a visitor.
 */
export const viewerGuard = (open: Open) =>
  createMiddleware<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>(async (c, next) => {
    const actorId = c.req.header(ACTOR_HEADER);
    const connectionString = connectionStringFrom(c.env);
    if (!connectionString) return c.json({ error: 'unavailable' }, 503);

    const { db, close } = open(connectionString);
    try {
      const [actor] = actorId
        ? await db
            .select({ id: profiles.id, role: profiles.role, status: profiles.status })
            .from(profiles)
            .where(eq(profiles.id, actorId))
        : [];
      c.set('db', db as AnyDb);
      c.set('actor', actor ?? null);
      await next();
    } finally {
      await close().catch(() => undefined);
    }
  });
