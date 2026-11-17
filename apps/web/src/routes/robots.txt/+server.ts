import { siteOf } from '@mesaaberta/core/server/site';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ locals }) =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${siteOf(locals.env, locals.log).APP_ORIGIN}/sitemap.xml\n`,
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    },
  );
