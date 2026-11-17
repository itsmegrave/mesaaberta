import { Hono } from 'hono';
import {
  createDb,
  connectionStringFrom,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { sitemapIndex, sitemapPage } from '@mesaaberta/core/server/seo/sitemap';
import { sitemapResource } from '@mesaaberta/core/seo/sitemap';

export function seoRoutes(open: typeof createDb = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv }>();
  app.get('/sitemap', async (c) => {
    const connection = connectionStringFrom(c.env);
    if (!connection) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connection);
    try {
      return c.json(await sitemapIndex(db));
    } finally {
      await close();
    }
  });
  app.get('/sitemap/:resource', async (c) => {
    const resource = sitemapResource.safeParse(c.req.param('resource'));
    const page = c.req.query('page') ?? '1';
    if (!resource.success || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
      return c.json({ error: 'not_found' }, 404);
    const connection = connectionStringFrom(c.env);
    if (!connection) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connection);
    try {
      const result = await sitemapPage(db, resource.data, Number(page));
      return result ? c.json(result) : c.json({ error: 'not_found' }, 404);
    } finally {
      await close();
    }
  });
  return app;
}
