import { requireAdmin } from '#lib/server/admin-access.js';
import { readFromApi } from '#lib/server/api-read.js';
import type { RequestHandler } from './$types';

/** Usernames for the recipient field's suggestions. Admins only, like everything under /admin. */
export const GET: RequestHandler = async ({ locals, url }) => {
  const admin = await requireAdmin(locals);
  const q = encodeURIComponent(url.searchParams.get('q') ?? '');
  return Response.json(
    await readFromApi<string[]>(locals, admin.id, `/v1/admin-reads/recipients?q=${q}`),
  );
};
