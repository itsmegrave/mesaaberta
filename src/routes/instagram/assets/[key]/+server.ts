import { error } from '@sveltejs/kit';
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { instagramPosts } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

// Meta fetches this without cookies. The random capability expires; no table/player metadata.
export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.db || !/^[0-9a-f-]{36}$/.test(params.key)) error(404);
  const [asset] = await locals.db
    .select({ image: instagramPosts.image })
    .from(instagramPosts)
    .where(
      and(
        eq(instagramPosts.assetKey, params.key),
        gt(instagramPosts.assetExpiresAt, new Date()),
        isNotNull(instagramPosts.image),
      ),
    );
  if (!asset?.image) error(404);
  return new Response(Buffer.from(asset.image, 'base64'), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
};
