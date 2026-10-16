import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { can } from '@mesaaberta/core/server/auth/policy';
import { instagramAccounts, instagramPosts } from '@mesaaberta/core/server/db/schema';
import { configured, decryptToken, type InstagramEnv } from '@mesaaberta/core/server/instagram/api';
import { instagramAdminActions } from '@mesaaberta/core/server/instagram/admin-actions';
import { publishInstagramAction } from '#lib/server/admin/instagram-action.js';
import { instagramViaApi } from '#lib/server/admin/instagram-api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503);
  const [account] = await locals.db
    .select({
      username: instagramAccounts.username,
      expiresAt: instagramAccounts.expiresAt,
      token: instagramAccounts.token,
    })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  const env = locals.env as InstagramEnv | undefined;
  // A token stored under another INSTAGRAM_TOKEN_KEY looks connected but can never publish, and
  // nothing else would offer to reconnect. The token itself never leaves the server.
  let unreadable = false;
  if (account && configured(env)) {
    try {
      await decryptToken(account.token, env!.INSTAGRAM_TOKEN_KEY!);
    } catch {
      unreadable = true;
    }
  }
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
    account: account ? { username: account.username, expiresAt: account.expiresAt } : null,
    unreadable,
    configured: configured(env),
    connected: url.searchParams.get('connected') === '1',
    connectionError: url.searchParams.has('connection_error'),
    uncertain,
  };
};

// Reconciliation requires an admin to inspect Instagram. It never authorizes another publish.
export const actions: Actions = {
  publish: publishInstagramAction,
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
    const profile = await locals.getProfile();
    const remote = profile
      ? await instagramViaApi(locals, profile.id, 'reconcile', { tableId, permalink })
      : null;
    if (remote && 'invalid' in remote) return fail(400, { invalid: true });
    if (!remote)
      await instagramAdminActions.reconcile.apply(locals.db, locals.env, { tableId, permalink });
    return { reconciled: true };
  },
};
