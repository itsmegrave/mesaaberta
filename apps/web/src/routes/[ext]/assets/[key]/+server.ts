import { error } from '@sveltejs/kit';
import { sendToApi } from '#lib/server/api-client.js';
import type { RequestHandler } from './$types';

// The network fetches this without cookies, so there is no admin check: the asset is a random,
// expiring capability that names no table or player. An id nobody installed is just a 404.
export const GET: RequestHandler = async ({ locals, params }) => {
  const answer = await sendToApi(
    locals.env,
    `/v1/widgets/assets/${encodeURIComponent(params.ext)}/${encodeURIComponent(params.key)}`,
    null,
  );
  if (answer?.status === 404) error(404);
  if (!answer?.ok) error(503, 'API unavailable');
  return new Response(answer.body, {
    headers: {
      'content-type': answer.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
};
