import { sitemapIndexSchema, sitemapPageSchema } from '@mesaaberta/core/seo/sitemap';
import { siteOf } from '@mesaaberta/core/server/site';
import { callApiRaw } from '#lib/server/api-client.js';
import { isPublished } from '#lib/blog.js';
import { posts } from '#lib/server/blog.js';

type Resource = 'index' | 'pages' | 'tables' | 'profiles';
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
const document = (root: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</${root}>`;
const staticPaths = ['/', '/t', '/p', '/cf', '/changelog', '/blog', '/privacy', '/terms'];
const unavailable = () =>
  new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: { 'cache-control': 'no-store', 'retry-after': '60' },
  });

export async function sitemapResponse(
  locals: App.Locals,
  resource: Resource,
  page: number,
): Promise<Response> {
  const origin = siteOf(locals.env, locals.log).APP_ORIGIN;
  const cache = locals.host?.cache;
  const key = `${origin}/__seo/v1/${resource}?page=${page}`;
  const success = (body: string) =>
    new Response(body, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  try {
    const cached = await cache?.get(key);
    if (cached) return success(cached);
  } catch {
    /* Cache failure must not replace the required API read. */
  }
  let body: string;
  if (resource === 'pages') {
    if (page !== 1) return new Response('Not found', { status: 404 });
    body = document(
      'urlset',
      [
        ...staticPaths.map((path) => `<url><loc>${escape(new URL(path, origin).href)}</loc></url>`),
        ...posts
          .filter((post) => isPublished(post))
          .map(
            (post) =>
              `<url><loc>${escape(new URL(`/blog/${post.slug}`, origin).href)}</loc><lastmod>${post.date}</lastmod></url>`,
          ),
      ].join(''),
    );
  } else {
    const path =
      resource === 'index' ? '/v1/seo/sitemap' : `/v1/seo/sitemap/${resource}?page=${page}`;
    const answer = await callApiRaw(locals.env, path, null, locals.log, undefined, {}, 'GET');
    if (answer?.status === 404)
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    if (!answer?.ok) return unavailable();
    if (resource === 'index') {
      const result = sitemapIndexSchema.safeParse(answer.body);
      if (!result.success) return unavailable();
      const locations = [`${origin}/sitemap-pages.xml`];
      for (const kind of ['tables', 'profiles'] as const) {
        for (let n = 1; n <= result.data[kind]; n++)
          locations.push(`${origin}/sitemap-${kind}.xml${n > 1 ? `?page=${n}` : ''}`);
      }
      body = document(
        'sitemapindex',
        locations.map((loc) => `<sitemap><loc>${escape(loc)}</loc></sitemap>`).join(''),
      );
    } else {
      const result = sitemapPageSchema.safeParse(answer.body);
      if (!result.success) return unavailable();
      body = document(
        'urlset',
        result.data.entries
          .map(
            ({ slug, lastmod }) =>
              `<url><loc>${escape(`${origin}/${resource === 'tables' ? 't' : 'u'}/${encodeURIComponent(slug)}`)}</loc>${lastmod ? `<lastmod>${escape(lastmod)}</lastmod>` : ''}</url>`,
          )
          .join(''),
      );
    }
  }
  try {
    await cache?.set(key, body, 300);
  } catch {
    /* A successful public response does not depend on cache writes. */
  }
  return success(body);
}
