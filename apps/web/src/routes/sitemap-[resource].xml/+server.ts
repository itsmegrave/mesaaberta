import { sitemapResponse } from '#lib/seo/sitemap.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ locals, params, url }) => {
  const match = /^(pages|tables|profiles)$/.exec(params.resource);
  const page = url.searchParams.get('page') ?? '1';
  if (!match || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
    return new Response('Not found', { status: 404 });
  return sitemapResponse(locals, match[1] as 'pages' | 'tables' | 'profiles', Number(page));
};
