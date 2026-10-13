import { Hono } from 'hono';
import type { ZodType } from 'zod';
import {
  createSchema,
  entrySchema,
  mergeSchema,
  renameSchema,
} from '@mesaaberta/core/admin/catalog';
import {
  approveEntry,
  createEntry,
  disableEntry,
  mergeEntry,
  rejectEntry,
  renameEntry,
} from '@mesaaberta/core/server/admin/catalog';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { createDb, type AnyDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { Invalid } from '@mesaaberta/core/server/errors';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;
type Apply = (db: AnyDb, actor: Actor, data: never) => Promise<string>;

/** One catalog decision: the form action's schema, and the service call it makes. */
const decisions: Record<string, { schema: ZodType; apply: Apply }> = {
  approve: {
    schema: entrySchema,
    apply: ((db, actor, d: { kind: never; id: string }) =>
      approveEntry(db, actor, d.kind, d.id)) as Apply,
  },
  reject: {
    schema: entrySchema,
    apply: ((db, actor, d: { kind: never; id: string }) =>
      rejectEntry(db, actor, d.kind, d.id)) as Apply,
  },
  disable: {
    schema: entrySchema,
    apply: ((db, actor, d: { kind: never; id: string }) =>
      disableEntry(db, actor, d.kind, d.id)) as Apply,
  },
  rename: {
    schema: renameSchema,
    apply: ((db, actor, d: { kind: never; id: string; name: string }) =>
      renameEntry(db, actor, d.kind, d.id, d.name)) as Apply,
  },
  merge: {
    schema: mergeSchema,
    apply: ((db, actor, d: { kind: never; id: string; into: string }) =>
      mergeEntry(db, actor, d.kind, d.id, d.into)) as Apply,
  },
  create: {
    schema: createSchema,
    apply: ((db, actor, d: { kind: never; name: string }) =>
      createEntry(db, actor, d.kind, d.name)) as Apply,
  },
};

/**
 * The catalog console's decisions of Trello #120 (approve, reject, disable, rename, merge, create),
 * moved out of the web form actions. The body is the form's own schema; the service authorizes the
 * actor again. Answers `{ eventId }` for the web Worker to dispatch (it does, after its response,
 * the way the in-process path does), or 400 `{ error: 'invalid', field, message }` with what the
 * service refused so the page can put it on the same field.
 */
export function catalogRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/:decision', async (c) => {
    const decision = decisions[c.req.param('decision')];
    if (!decision) return c.json({ error: 'not_found' }, 404);

    const parsed = decision.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const eventId = await decision.apply(c.get('db'), c.get('actor'), parsed.data as never);
      return c.json({ eventId });
    } catch (error) {
      if (error instanceof Invalid)
        return c.json({ error: 'invalid', field: error.field, message: error.message }, 400);
      throw error;
    }
  });

  return app;
}
