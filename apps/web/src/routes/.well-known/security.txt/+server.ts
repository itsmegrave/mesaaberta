import { siteOf } from '@mesaaberta/core/server/site';
import type { RequestHandler } from './$types';
import { securityTxt } from './security-txt';

export const GET: RequestHandler = ({ locals }) => {
  const site = siteOf(locals.env, locals.log);
  return new Response(securityTxt(site.APP_ORIGIN, site.CONTACT_EMAIL), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
};
