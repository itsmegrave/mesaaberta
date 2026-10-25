import { describe, expect, it, vi } from 'vitest';
import { sitemapResponse } from './sitemap';
import { GET as robots } from '../../routes/robots.txt/+server';
const origin = 'https://mesaaberta.example';
const locals = (fetch: (request: Request) => Promise<Response>) =>
  ({
    env: { APP_ORIGIN: origin, API: { fetch } },
    host: {},
    log: { warn: vi.fn() },
  }) as unknown as App.Locals;
describe('sitemap transport', () => {
  it('uses the required API and configured origin for index and escaped XML', async () => {
    const fetch = vi.fn(async () => Response.json({ tables: 1, profiles: 2 }));
    const response = await sitemapResponse(locals(fetch), 'index', 1);
    const xml = await response.text();
    expect(xml).toContain(`${origin}/sitemap-profiles.xml?page=2`);
    expect(xml).toContain(`${origin}/sitemap-pages.xml`);
    expect(fetch).toHaveBeenCalledOnce();
    const page = await sitemapResponse(
      locals(async () =>
        Response.json({ entries: [{ slug: 'a&b', lastmod: '2026-10-20T12:00:00.000Z' }] }),
      ),
      'tables',
      1,
    );
    expect(await page.text()).toContain('/t/a%26b</loc><lastmod>2026-10-20');
  });
  it('keeps sitemap URLs on the configured origin when contact configuration is invalid', async () => {
    const context = locals(async () => Response.json({ tables: 1, profiles: 1 }));
    context.env = { ...context.env, CONTACT_EMAIL: 'invalid' } as unknown as App.Locals['env'];
    for (const resource of ['index', 'pages', 'tables'] as const) {
      if (resource === 'tables')
        context.env = {
          ...context.env,
          API: { fetch: async () => Response.json({ entries: [{ slug: 'public-table' }] }) },
        } as App.Locals['env'];
      const response = await sitemapResponse(context, resource, 1);
      expect(response.status).toBe(200);
      const xml = await response.text();
      expect(xml).toContain(origin);
      expect(xml).not.toContain('localhost');
    }
    const response = await robots({ locals: context } as Parameters<typeof robots>[0]);
    expect(await response.text()).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });

  it('answers unavailable rather than an empty successful sitemap on API failure', async () => {
    for (const fetch of [
      async () => Response.json({ error: 'failed' }, { status: 503 }),
      async () => Response.json({ tables: -1 }),
      async () => {
        throw new Error('offline');
      },
    ]) {
      const response = await sitemapResponse(locals(fetch), 'index', 1);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('never calls the API for static pages or caches service errors', async () => {
    const fetch = vi.fn(async () => Response.json({}, { status: 503 }));
    const context = locals(fetch);
    context.host.cache = { get: async () => undefined, set: vi.fn() };
    expect((await sitemapResponse(context, 'pages', 1)).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    await sitemapResponse(context, 'index', 1);
    expect(context.host.cache.set).toHaveBeenCalledTimes(1);
  });
});
