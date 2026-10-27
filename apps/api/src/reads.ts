import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { readTables } from '@mesaaberta/core/server/reads/tables';
import { readTableFilters } from '@mesaaberta/core/tables/filters';
import { readPreview } from '@mesaaberta/core/server/reads/preview';
import { readDashboard } from '@mesaaberta/core/server/reads/dashboard';
import { readDetail } from '@mesaaberta/core/server/reads/detail';
import { readManage } from '@mesaaberta/core/server/reads/manage';
import { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
import { viewerTimezone } from '@mesaaberta/core/time/timezone';
import { placeOptions, withPlace } from '@mesaaberta/core/server/places/picker';
import { withLocation } from '@mesaaberta/core/server/location/cep';
import { tableInputSchema } from '@mesaaberta/core/tables/schema';
import { z } from 'zod';
import { loadTableForEdit } from '@mesaaberta/core/server/tables/write';
import { readHome } from '@mesaaberta/core/server/reads/home';
import { listSystemDirectory, readSystemPage } from '@mesaaberta/core/server/systems/directory';
import { readSystemDirectoryFilters } from '@mesaaberta/core/systems/directory-filters';
import { gmDirectorySystems, listGmDirectory } from '@mesaaberta/core/server/gms/directory';
import { readGmDirectoryFilters } from '@mesaaberta/core/gms/directory-filters';
import { listPlaces, readPlacePage } from '@mesaaberta/core/server/places/directory';
import { readPlaceFilters } from '@mesaaberta/core/places/filters';
import { can } from '@mesaaberta/core/server/auth/policy';
import { refusal } from './refusal';
import { userGuard, viewerGuard, type UserVariables, type ViewerVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The read side of Trello #120: `GET /v1/reads/:resource` answers the JSON a web page reader
 * shows; the web Worker reads no database for these pages. The subject is always the actor the web
 * Worker names, never a query parameter. `preview`, `tables` and `detail/:slug` are open to visitors
 * too (no actor header); `catalog`, `dashboard`, `edit-catalog/:slug` and `manage/:slug` need one.
 */
export function readRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  const visitors = new Hono<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>();

  visitors.use('*', viewerGuard(open));

  visitors.get('/preview', async (c) => c.json(await readPreview(c.get('db'), publicReadNow())));

  visitors.get('/tables', async (c) =>
    c.json(
      // The same validation web ran: what is not a filter is dropped, not refused.
      await readTables(c.get('db'), await readTableFilters(new URL(c.req.url)), publicReadNow()),
    ),
  );

  visitors.get('/detail/:slug', async (c) => {
    // An unknown, disabled or someone else's draft table is a 404: web then answers its own.
    const detail = await readDetail(c.get('db'), c.get('actor'), c.req.param('slug'), new Date());
    return detail ? c.json(detail) : c.json({ error: 'not_found' }, 404);
  });

  // The directories (web checks their flags first). A page past the last one is a 404 in each.
  visitors.get('/systems', async (c) => {
    const list = await listSystemDirectory(
      c.get('db'),
      readSystemDirectoryFilters(new URL(c.req.url).searchParams),
      publicReadNow(),
    );
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  // A merged system answers `{ redirectTo }`, the slug it was merged into.
  visitors.get('/systems/:slug', async (c) => {
    const found = await readSystemPage(c.get('db'), c.req.param('slug'), new Date());
    return found ? c.json(found) : c.json({ error: 'not_found' }, 404);
  });

  // `badges=1` while `use_badges` is on for the viewer (web reads the flag).
  visitors.get('/gamemasters', async (c) => {
    const [list, systems] = await Promise.all([
      listGmDirectory(
        c.get('db'),
        readGmDirectoryFilters(new URL(c.req.url).searchParams),
        publicReadNow(),
        { showBadges: c.req.query('badges') === '1' },
      ),
      gmDirectorySystems(c.get('db')),
    ]);
    return list ? c.json({ ...list, systems }) : c.json({ error: 'not_found' }, 404);
  });

  visitors.get('/places', async (c) => {
    const list = await listPlaces(
      c.get('db'),
      readPlaceFilters(new URL(c.req.url).searchParams),
      publicReadNow(),
    );
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  // A place waiting for review or hidden opens only for whoever sent it, owns it or moderates.
  visitors.get('/places/:slug', async (c) => {
    const actor = c.get('actor');
    const viewer = actor ? { id: actor.id, isAdmin: can(actor, 'admin:access') } : null;
    const found = await readPlacePage(c.get('db'), c.req.param('slug'), viewer, new Date());
    return found ? c.json(found) : c.json({ error: 'not_found' }, 404);
  });

  app.route('/', visitors);
  app.use('*', userGuard(open));

  app.get('/catalog', async (c) => c.json(await readCatalog(c.get('db'), c.get('actorId'))));

  app.get('/edit-catalog/:slug', async (c) => {
    // The zone web resolved for this person (profile, else browser); an unknown one reads as the default.
    const { timezone } = viewerTimezone(c.req.query('tz'), null);
    try {
      return c.json(
        await readEditCatalog(c.get('db'), c.get('actor'), c.req.param('slug'), timezone),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // The "Onde jogar" picker of the new-table and edit forms: the listed places.
  app.get('/place-options', async (c) => c.json(await placeOptions(c.get('db'))));

  // Where a table the GM is saving happens: the "Onde jogar" place they picked (`placeSlug`, only
  // while the places are on, which web decides) brings its CEP and area; otherwise the CEP they
  // typed is looked up. Answers the input to save, or the refusal on the field.
  app.post('/table-location', async (c) => {
    const parsed = z
      .object({ input: tableInputSchema, placeSlug: z.string().max(200) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    const { input, placeSlug } = parsed.data;
    try {
      return c.json(
        placeSlug && input.modality === 'in_person'
          ? await withPlace(c.get('db'), input, placeSlug)
          : await withLocation(c.get('db'), input),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // A table as its edit form shows it, times in the zone web resolved (`?tz=`). Someone else's
  // table is a 403 (a concluded one says why); one that is not there a 404.
  app.get('/table-edit/:slug', async (c) => {
    const { timezone } = viewerTimezone(c.req.query('tz'), null);
    try {
      return c.json(
        await loadTableForEdit(c.get('db'), c.get('actor'), c.req.param('slug'), timezone),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // The signed-in Início. `follows=1` while following is on for the actor (web reads the flag).
  app.get('/home', async (c) => {
    const home = await readHome(c.get('db'), c.get('actorId'), publicReadNow(), {
      follows: c.req.query('follows') === '1',
    });
    return home ? c.json(home) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/dashboard', async (c) => {
    // Always the actor's own tables. A page past the last is a 404: web then answers its own.
    const dashboard = await readDashboard(
      c.get('db'),
      c.get('actorId'),
      c.req.query('page') ?? null,
      new Date(),
    );
    return dashboard ? c.json(dashboard) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/manage/:slug', async (c) => {
    try {
      return c.json(await readManage(c.get('db'), c.get('actor'), c.req.param('slug'), new Date()));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
