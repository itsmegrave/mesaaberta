import { siteOf } from '@mesaaberta/core/server/site';
import { blogFeed } from '#lib/server/blog-feed.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) =>
  new Response(blogFeed(siteOf(locals.env, locals.log).APP_ORIGIN), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
