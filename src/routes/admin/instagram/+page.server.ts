import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { can } from '$lib/server/auth/policy';
import { instagramAccounts, instagramPosts } from '$lib/server/db/schema';
import { configured, type InstagramEnv } from '$lib/server/instagram/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503);
  const [account] = await locals.db
    .select({ username: instagramAccounts.username, expiresAt: instagramAccounts.expiresAt })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  const uncertain = await locals.db
    .select({
      tableId: instagramPosts.tableId,
      containerId: instagramPosts.containerId,
      createdAt: instagramPosts.createdAt,
    })
    .from(instagramPosts)
    .where(eq(instagramPosts.status, 'uncertain'))
    .limit(50);
  return {
    account: account ?? null,
    configured: configured(platform?.env as InstagramEnv),
    connected: url.searchParams.get('connected') === '1',
    connectionError: url.searchParams.has('connection_error'),
    uncertain,
  };
};

// Reconciliation requires an admin to inspect Instagram. It never authorizes another publish.
export const actions: Actions = {
  reconcile: async ({ locals, request }) => {
    if (!can(await locals.getProfile(), 'admin:access')) error(404);
    if (!locals.db) error(503);
    const form = await request.formData();
    const tableId = String(form.get('tableId') ?? '');
    const permalink = String(form.get('permalink') ?? '');
    if (
      !/^[0-9a-f-]{36}$/.test(tableId) ||
      !/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/$/.test(permalink)
    )
      return fail(400, { invalid: true });
    await locals.db
      .update(instagramPosts)
      .set({ status: 'published', permalink, image: null, lastError: null })
      .where(and(eq(instagramPosts.tableId, tableId), eq(instagramPosts.status, 'uncertain')));
    return { reconciled: true };
  },
};
