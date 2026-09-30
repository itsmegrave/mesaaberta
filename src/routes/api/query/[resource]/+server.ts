import { error, isRedirect } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { resources, type Resource } from '$lib/query/keys';
import { readers } from '$lib/server/reads/load';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async (event) => {
  if (!resources.includes(event.params.resource as Resource)) error(404, 'Not found');
  const resource = event.params.resource as Resource;
  const slug = event.url.searchParams.get('slug');
  if ((resource === 'detail' || resource === 'manage' || resource === 'editCatalog') && !slug)
    error(400, 'Missing slug');
  try {
    // All readers reuse server-side identity and policy; browser parameters never select a viewer.
    const data = await readers[resource]({
      ...event,
      params: { ...event.params, ...(slug ? { slug } : {}) },
    });
    return new Response(stringify(data), {
      headers: {
        'content-type': 'application/json',
        'x-query-codec': 'devalue',
        'cache-control': 'private, no-store',
        'x-query-viewer': (await event.locals.getUser())?.id ?? 'anonymous',
      },
    });
  } catch (cause) {
    if (isRedirect(cause)) error(401, 'Sign in required');
    throw cause;
  }
};
