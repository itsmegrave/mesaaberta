import { Hono } from 'hono';
import { createDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { adminOverview } from '@mesaaberta/core/server/admin/queries';
import {
  adminActivity,
  adminProfile,
  listAdminProfiles,
} from '@mesaaberta/core/server/admin/profiles';
import { profileHistory } from '@mesaaberta/core/server/admin/history';
import { adminBadgesOf } from '@mesaaberta/core/server/badges/admin';
import { moderationOf } from '@mesaaberta/core/server/moderation/admin';
import { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { instagramAccounts } from '@mesaaberta/core/server/db/schema';
import { eq } from 'drizzle-orm';
import { adminCounts } from '@mesaaberta/core/server/admin/counts';
import { adminTable } from '@mesaaberta/core/server/admin/tables';
import { tableHistory } from '@mesaaberta/core/server/admin/history';
import { badgeCatalogAdmin } from '@mesaaberta/core/server/badges/admin';
import { auditLog, listReports, reportDetail } from '@mesaaberta/core/server/moderation/admin';
import {
  audienceSizes,
  listAnnouncements,
  searchRecipients,
} from '@mesaaberta/core/server/notifications/announcements';
import {
  CATALOG_PAGE_SIZE,
  CATALOG_SORTS,
  CATALOG_STATUS_FILTERS,
  listApproved,
  listCatalogAdmin,
  listQueue,
  recentDecisions,
} from '@mesaaberta/core/server/admin/catalog';
import { CATALOG_KINDS, pageNumber, type CatalogKind } from '@mesaaberta/core/admin/catalog';
import { pageSizeOf, sortOf, type Sort } from '@mesaaberta/core/admin/list';
import { listAdminCrowdfundings } from '@mesaaberta/core/server/crowdfunding/admin';
import { listAdminPartners } from '@mesaaberta/core/server/partners/admin';
import { listAdminPlaces } from '@mesaaberta/core/server/places/admin';
import { listClaims } from '@mesaaberta/core/server/places/claims';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { z } from 'zod';
import { adminGuard, type AdminVariables } from './admin-guard';
import { refusal } from './refusal';

const uuid = z.guid();

type Open = typeof createDb;

/**
 * The admin side of the read side (Trello #120): `GET /v1/admin-reads/overview`, `users` and
 * `tables` answer the JSON the web app's admin pages show (the web Worker reads no database for
 * them). The actor is checked
 * against the database by the admin guard; the list filters travel as the query string web got, and
 * the pictures stay storage paths (web builds the URLs).
 */
export function adminReadRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));
  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  app.get('/overview', async (c) => c.json(await adminOverview(c.get('db'))));

  app.get('/users', async (c) =>
    c.json(await listAdminProfiles(c.get('db'), new URL(c.req.url).searchParams)),
  );

  // With when the site's social token runs out (null: none connected), for the post column.
  // The connector's account still lives in Instagram's table, which stays public.
  app.get('/tables', async (c) => {
    const [tables, [account]] = await Promise.all([
      listAdminTables(c.get('db'), new URL(c.req.url).searchParams),
      c
        .get('db')
        .select({ expiresAt: instagramAccounts.expiresAt })
        .from(instagramAccounts)
        .where(eq(instagramAccounts.id, 'mesaaberta')),
    ]);
    return c.json({ ...tables, socialExpiresAt: account?.expiresAt ?? null });
  });

  // What waits on an admin, beside each section.
  app.get('/counts', async (c) => c.json(await adminCounts(c.get('db'))));

  // Every badge with how many hold it and how many were taken away.
  app.get('/badges', async (c) => c.json(await badgeCatalogAdmin(c.get('db'), c.get('actor'))));

  // The audit log and the reports list, for the filters in the query string (a page past the last
  // is a 404).
  app.get('/audit', async (c) => {
    const log = await auditLog(c.get('db'), c.get('actor'), new URL(c.req.url).searchParams);
    return log ? c.json(log) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/reports', async (c) => {
    const list = await listReports(c.get('db'), c.get('actor'), new URL(c.req.url).searchParams);
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/reports/:id', async (c) => {
    if (!uuid.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    const report = await reportDetail(c.get('db'), c.get('actor'), c.req.param('id'));
    return report ? c.json(report) : c.json({ error: 'not_found' }, 404);
  });

  // The announcements page: how many each audience reaches, and what was sent.
  app.get('/announcements', async (c) => {
    const [sizes, history] = await Promise.all([
      audienceSizes(c.get('db')),
      listAnnouncements(c.get('db')),
    ]);
    return c.json({ sizes, history });
  });

  // Usernames for the announcement recipient field's suggestions.
  app.get('/recipients', async (c) =>
    c.json((await searchRecipients(c.get('db'), c.req.query('q') ?? '')).map((p) => p.username)),
  );

  // The review lists, for the filters in the query string (a page past the last is a 404).
  const lists: Record<
    string,
    (db: AnyDb, actor: Actor, params: URLSearchParams) => Promise<unknown>
  > = {
    places: listAdminPlaces,
    claims: listClaims,
    crowdfundings: listAdminCrowdfundings,
    partners: listAdminPartners,
  };
  for (const [name, list] of Object.entries(lists))
    app.get(`/${name}`, async (c) => {
      const found = await list(c.get('db'), c.get('actor'), new URL(c.req.url).searchParams);
      return found ? c.json(found) : c.json({ error: 'not_found' }, 404);
    });

  // The catalog console for the kind and filters in the query string, with the approved entries
  // of that kind (a page past the last is a 404; the first page always exists).
  app.get('/catalog', async (c) => {
    const params = new URL(c.req.url).searchParams;
    const asked = params.get('kind');
    const kind: CatalogKind = CATALOG_KINDS.find((value) => value === asked) ?? 'platform';
    const query = (params.get('q') ?? '').trim().slice(0, 40);
    const page = pageNumber(params.get('page'));
    const statusAsked = params.get('status');
    const status = CATALOG_STATUS_FILTERS.find((value) => value === statusAsked) ?? 'all';
    const pageSize = pageSizeOf(params, CATALOG_PAGE_SIZE);
    // The catalog keeps its own order (the pickers' order) until a column is asked for.
    const sorted = params.get('sort');
    const sort: Sort<(typeof CATALOG_SORTS)[number]> | null = CATALOG_SORTS.some(
      (value) => value === sorted,
    )
      ? sortOf(params, CATALOG_SORTS, { id: 'name', dir: 'asc' })
      : null;

    const list = await listCatalogAdmin(c.get('db'), kind, {
      query,
      page,
      pageSize,
      status,
      sort,
    });
    if (page > list.pages) return c.json({ error: 'not_found' }, 404);
    return c.json({
      kind,
      query,
      status,
      sort,
      ...list,
      approved: (await listApproved(c.get('db')))[kind],
    });
  });

  // The catalog queue: suggestions waiting, the latest decisions and the approved catalog.
  app.get('/queue', async (c) => {
    const [queue, decisions, approved] = await Promise.all([
      listQueue(c.get('db')),
      recentDecisions(c.get('db')),
      listApproved(c.get('db')),
    ]);
    return c.json({ queue, decisions, approved });
  });

  // One person for the admin: the profile, activity, history, moderation and, with `badges=1`
  // (web asks while `use_badges` is on for the admin), their badges.
  app.get('/users/:id', async (c) => {
    const id = c.req.param('id');
    if (!uuid.safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const db = c.get('db');
    const profile = await adminProfile(db, id);
    if (!profile) return c.json({ error: 'not_found' }, 404);
    const [activity, history, moderation, badges] = await Promise.all([
      adminActivity(db, id),
      profileHistory(db, c.get('actor'), id),
      moderationOf(db, c.get('actor'), id),
      c.req.query('badges') === '1' ? adminBadgesOf(db, c.get('actor'), id) : null,
    ]);
    return c.json({ profile, activity, history, moderation, badges });
  });

  // One table for the admin, with its history.
  app.get('/tables/:id', async (c) => {
    if (!uuid.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    const table = await adminTable(c.get('db'), c.req.param('id'));
    if (!table) return c.json({ error: 'not_found' }, 404);
    return c.json({
      table,
      history: await tableHistory(c.get('db'), c.get('actor'), c.req.param('id')),
    });
  });

  return app;
}
