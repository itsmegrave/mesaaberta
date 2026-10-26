import { sitemapResponse } from '#lib/seo/sitemap.js';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ locals }) => sitemapResponse(locals, 'index', 1);
