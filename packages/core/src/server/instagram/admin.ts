import { count, eq } from 'drizzle-orm';
import type { AdminSurface } from '../extensions/contract';
import { instagramAccounts, instagramPosts } from '../db/schema';
import { configured, decryptToken, type InstagramEnv } from './api';

/** The Instagram panel of the admin's connections page: the account, and posts to reconcile. */
export const instagramAdmin: AdminSurface = {
  async count(db) {
    const [{ posts }] = await db
      .select({ posts: count() })
      .from(instagramPosts)
      .where(eq(instagramPosts.status, 'uncertain'));
    return posts;
  },
  async load(db, env) {
    const instagram = env as (InstagramEnv & { INSTAGRAM_TOKEN_KEY?: string }) | undefined;
    const [account] = await db
      .select({
        username: instagramAccounts.username,
        expiresAt: instagramAccounts.expiresAt,
        token: instagramAccounts.token,
      })
      .from(instagramAccounts)
      .where(eq(instagramAccounts.id, 'mesaaberta'));
    // A token stored under another INSTAGRAM_TOKEN_KEY looks connected but can never publish, and
    // nothing else would offer to reconnect. The token itself never leaves the server.
    let unreadable = false;
    if (account && configured(instagram)) {
      try {
        await decryptToken(account.token, instagram!.INSTAGRAM_TOKEN_KEY!);
      } catch {
        unreadable = true;
      }
    }
    const uncertain = await db
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
      configured: configured(instagram),
      uncertain,
    };
  },
};
