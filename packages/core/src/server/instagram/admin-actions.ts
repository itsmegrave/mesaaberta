import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AnyDb } from '../db/client';
import { instagramAccounts, instagramPosts } from '../db/schema';
import { socialFor, type SocialEnv } from '../social/index';
import type { InstagramEnv } from './api';

const tableId = z.string().regex(/^[0-9a-f-]{36}$/i);

/**
 * What an admin does about an Instagram post by hand, by name: queue a table (the durable job the
 * background publisher then renders and sends), save the connected account (`connect`) and reconcile
 * an ambiguous post once they have looked at Meta. The web form actions and the api route (`POST /v1/admin/instagram/:action`) both run
 * these. Neither renders an image or calls Meta: the render and the publish stay in the background.
 */
export const instagramAdminActions = {
  queue: {
    schema: z.object({ tableId }),
    apply: async (db: AnyDb, env: InstagramEnv & SocialEnv, data: { tableId: string }) => ({
      result: await socialFor(env).queueTable(db, env, data.tableId),
    }),
  },
  // The OAuth callback saves the connected account. The web Worker has already traded the code, read
  // the account from Meta and encrypted the token, so what arrives here is the encrypted token and
  // never the plain one or the app secret.
  connect: {
    schema: z.object({
      userId: z.string().min(1),
      username: z.string().min(1),
      token: z.string().min(1),
      expiresAt: z.string().datetime(),
    }),
    apply: async (
      db: AnyDb,
      _env: unknown,
      data: { userId: string; username: string; token: string; expiresAt: string },
    ) => {
      const values = { ...data, expiresAt: new Date(data.expiresAt) };
      await db
        .insert(instagramAccounts)
        .values(values)
        .onConflictDoUpdate({ target: instagramAccounts.id, set: values });
      return { connected: true };
    },
  },
  // Reconciliation requires an admin to inspect Instagram. It never authorizes another publish.
  reconcile: {
    schema: z.object({
      tableId,
      permalink: z.string().regex(/^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/$/),
    }),
    apply: async (db: AnyDb, _env: unknown, data: { tableId: string; permalink: string }) => {
      await db
        .update(instagramPosts)
        .set({ status: 'published', permalink: data.permalink, image: null, lastError: null })
        .where(
          and(eq(instagramPosts.tableId, data.tableId), eq(instagramPosts.status, 'uncertain')),
        );
      return { reconciled: true };
    },
  },
};

export type InstagramAdminActionName = keyof typeof instagramAdminActions;
