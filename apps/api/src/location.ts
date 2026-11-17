import { Hono } from 'hono';
import { normalizeCep } from '@mesaaberta/core/location/cep';
import { lookupCep } from '@mesaaberta/core/server/location/cep';
import { recordAttempt } from '@mesaaberta/core/server/auth/attempt-limit';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/** The address a CEP points to, for the forms that fill one in (Trello #120). */
export function locationRoutes(open: Open = openDb, request: typeof fetch = fetch) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  app.use('/*', userGuard(open));
  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  // `?value=` (any spelling of the 8 digits). 60 lookups a minute per person; an outage of the
  // provider is a 503, never a cacheable "not found".
  app.get('/cep', async (c) => {
    const value = normalizeCep(c.req.query('value') ?? '');
    if (!value) return c.json({ error: 'invalid', field: 'value' }, 400);
    const db = c.get('db');
    await recordAttempt(db, { action: 'cep_lookup', max: 60, windowSeconds: 60 }, c.get('actorId'));
    const result = await lookupCep(db, value, request);
    if (result.status === 'unavailable') return c.json({ error: 'unavailable' }, 503);
    return c.json(result);
  });

  return app;
}
