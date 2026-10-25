import { and, eq, gt, isNotNull } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { instagramPosts } from '@mesaaberta/core/server/db/schema';
import type { PublicAsset } from '@mesaaberta/core/server/extensions/contract';

/** The share image of a post, by the random key in its URL. It expires; nothing names a table or player. */
export async function instagramAsset(db: AnyDb, key: string): Promise<PublicAsset | null> {
  if (!/^[0-9a-f-]{36}$/.test(key)) return null;
  const [asset] = await db
    .select({ image: instagramPosts.image })
    .from(instagramPosts)
    .where(
      and(
        eq(instagramPosts.assetKey, key),
        gt(instagramPosts.assetExpiresAt, new Date()),
        isNotNull(instagramPosts.image),
      ),
    );
  if (!asset?.image) return null;
  const binary = atob(asset.image);
  const body = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) body[index] = binary.charCodeAt(index);
  return { body, type: 'image/jpeg' };
}
