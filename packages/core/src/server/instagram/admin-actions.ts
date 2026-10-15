import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { AnyDb } from '../db/client';
import { instagramPosts } from '../db/schema';
import { socialFor, type SocialEnv } from '../social/index';
import type { InstagramEnv } from './api';

const tableId = z.string().regex(/^[0-9a-f-]{36}$/i);

/**
 * What an admin does about an Instagram post by hand, by name: queue a table (the durable job the
 * background publisher then renders and sends) and reconcile an ambiguous post once they have looked
 * at Meta. The web form actions and the api route (`POST /v1/admin/instagram/:action`) both run
 * these. Neither renders an image or calls Meta: the render and the publish stay in the background.
 */
export const instagramAdminActions = {
  queue: {
    schema: z.object({ tableId }),
    apply: async (db: AnyDb, env: InstagramEnv & SocialEnv, data: { tableId: string }) => ({
      result: await socialFor(env).queueTable(db, env, data.tableId),
    }),
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
