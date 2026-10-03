import { error, type RequestEvent } from '@sveltejs/kit';
import { imageUrl, supabaseUrlOf } from '../images';
import { requireAdmin } from '../admin-access';
import { adminOverview } from '../admin/queries';

export async function read({ locals, platform, setHeaders }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const overview = await adminOverview(locals.db);
  const supabase = supabaseUrlOf(platform?.env);
  return {
    ...overview,
    // The page gets the cover to draw, not the storage path.
    recent: overview.recent.map(({ imagePath, ...row }) => ({
      ...row,
      cover: imageUrl(supabase, imagePath),
    })),
  };
}
