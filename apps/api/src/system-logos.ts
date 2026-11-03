import { Hono } from 'hono';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { logoStatusOf } from '@mesaaberta/core/admin/system-logos';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { createDb, type AnyDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { Invalid } from '@mesaaberta/core/server/errors';
import {
  approveLogo,
  approveSureLogos,
  decisionSchema,
  forgetLogo,
  listSystemLogos,
  recordLogoSearch,
  recordSchema,
  rejectLogo,
  systemsToSearch,
  uploadLogo,
  uploadSchema,
} from '@mesaaberta/core/server/systems/logos/service';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;
type Run = (db: AnyDb, actor: Actor) => Promise<unknown>;

/**
 * The game systems' logos (the admin's `/admin/catalog/logos`). The web Worker runs the finder and
 * stores the pictures (it has the storage key); this records what it found and the admin's
 * decisions. Writes that free a file answer its path (`unused`, `replaced`, `removed`) for web to
 * delete. Admins only, like every `/v1/admin` route; the service checks the actor again.
 */
export function systemLogoRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();
  app.use('*', adminGuard(open));

  app.get('/', async (c) => {
    const status = logoStatusOf(c.req.query('status') ?? null);
    const list = await listSystemLogos(c.get('db'), c.get('actor'), {
      status,
      page: pageNumber(c.req.query('page') ?? null),
    });
    return list ? c.json({ status, ...list }) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/to-search', async (c) => {
    const limit = Number(c.req.query('limit')) || undefined;
    return c.json({ systems: await systemsToSearch(c.get('db'), c.get('actor'), limit) });
  });

  // Each action parses its body (throwing on a bad one) and answers the service call to make.
  const actions: Record<string, (body: unknown) => Run> = {
    record: (body) => {
      const data = recordSchema.parse(body);
      return (db, actor) => recordLogoSearch(db, actor, data);
    },
    upload: (body) => {
      const data = uploadSchema.parse(body);
      return (db, actor) => uploadLogo(db, actor, data);
    },
    approve: (body) => {
      const { systemId } = decisionSchema.parse(body);
      return (db, actor) => approveLogo(db, actor, systemId);
    },
    approveSure: () => (db, actor) => approveSureLogos(db, actor),
    reject: (body) => {
      const { systemId } = decisionSchema.parse(body);
      return (db, actor) => rejectLogo(db, actor, systemId);
    },
    forget: (body) => {
      const { systemId } = decisionSchema.parse(body);
      return (db, actor) => forgetLogo(db, actor, systemId);
    },
  };

  app.post('/:action', async (c) => {
    const action = Object.hasOwn(actions, c.req.param('action'))
      ? actions[c.req.param('action')]
      : null;
    if (!action) return c.json({ error: 'not_found' }, 404);
    let run: Run;
    try {
      run = action(await c.req.json().catch(() => ({})));
    } catch {
      return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    }
    try {
      return c.json(await run(c.get('db'), c.get('actor')));
    } catch (error) {
      if (error instanceof Invalid)
        return c.json({ error: 'invalid', field: error.field, message: error.message }, 400);
      throw error;
    }
  });

  return app;
}
