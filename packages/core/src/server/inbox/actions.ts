import { z } from 'zod';
import '../../forms/zod-codes';
import { messageSchema, muteSchema } from '../../messages/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { openDirect, sendMessage, setMuted } from '../messages/service';
import { markAllRead, markRead } from '../notifications/service';

const conversation = { conversationId: z.guid() };

/**
 * What a person does in their inbox, by name: send and mute in a conversation, and the
 * notification feed's open, read and read-all. The web form actions and the api route
 * (`POST /v1/inbox/:action`) both run these. The subject is always the actor, and the services
 * authorize membership and the rate limit. Each answers an object merged into the response.
 */
export const inboxActions = {
  send: {
    schema: messageSchema.extend(conversation),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      data: { conversationId: string; body: string; tableId?: string },
    ) => {
      await sendMessage(db, actor, data.conversationId, data.body, {
        tableId: data.tableId ?? null,
      });
      return {};
    },
  },
  mute: {
    schema: muteSchema.extend(conversation),
    apply: async (
      db: AnyDb,
      actor: Actor | null,
      data: { conversationId: string; muted: boolean },
    ) => {
      await setMuted(db, actor, data.conversationId, data.muted);
      return {};
    },
  },
  // The direct conversation with someone, made when there is none (a profile, a table, the GM's
  // player rows, the admin's user page). `directBlocker` decides who may start one.
  direct: {
    schema: z.object({ recipientId: z.guid() }),
    apply: async (db: AnyDb, actor: Actor | null, data: { recipientId: string }) => ({
      conversationId: (await openDirect(db, actor, data.recipientId)).id,
    }),
  },
  // Marks a notification read and says where it leads (null when it has no link or is not theirs).
  open: {
    schema: z.object({ id: z.guid() }),
    apply: async (db: AnyDb, actor: Actor | null, data: { id: string }) => ({
      link: actor ? ((await markRead(db, actor.id, data.id))?.link ?? null) : null,
    }),
  },
  read: {
    schema: z.object({ id: z.guid() }),
    apply: async (db: AnyDb, actor: Actor | null, data: { id: string }) => {
      if (actor) await markRead(db, actor.id, data.id);
      return {};
    },
  },
  readAll: {
    schema: z.object({}),
    apply: async (db: AnyDb, actor: Actor | null) => {
      if (actor) await markAllRead(db, actor.id);
      return {};
    },
  },
};

export type InboxActionName = keyof typeof inboxActions;
