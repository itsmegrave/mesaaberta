import { z } from 'zod';
import { directMessagesSchema } from '../../messages/schema';
import { profileSchema } from '../../profile/schema';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { setDirectMessages } from '../messages/service';
import { Invalid } from '../errors';
import { loadProfileForm, saveProfile } from '../profile/service';
import { setAvatarPath } from './service';

/**
 * What a signed-in person does to their own profile, by name: the form's own schema and the service
 * call. The web form actions and the api route (`POST /v1/account/:action`) both run these. A
 * person only ever changes their own profile, so the actor is the subject; nothing here takes an
 * id from the request. The events these write are picked up by the sweeper, as before.
 */
export const accountActions = {
  save: {
    schema: profileSchema,
    // The username is chosen once: the stored one wins over whatever the request carries.
    prepare: async (db: AnyDb, actor: Actor, body: Record<string, unknown>) => ({
      ...body,
      username: (await loadProfileForm(db, actor.id))?.username ?? '',
    }),
    apply: async (db: AnyDb, actor: Actor, data: Parameters<typeof saveProfile>[2]) => {
      await saveProfile(db, actor.id, data);
    },
  },
  messages: {
    schema: directMessagesSchema,
    prepare: async (_db: AnyDb, _actor: Actor, body: Record<string, unknown>) => body,
    apply: async (db: AnyDb, actor: Actor, data: { enabled: boolean }) => {
      await setDirectMessages(db, actor.id, data.enabled);
    },
  },
  // The picture the web Worker already stored (a path in the avatar bucket, the person's own folder)
  // or null to remove it. Answers the file it replaced, for the web Worker to delete with the
  // person's own session.
  avatar: {
    schema: z.object({
      path: z
        .string()
        .max(300)
        .regex(/^[A-Za-z0-9/_.-]+$/)
        .nullable(),
    }),
    prepare: async (_db: AnyDb, _actor: Actor, body: Record<string, unknown>) => body,
    apply: async (db: AnyDb, actor: Actor, data: { path: string | null }) => {
      if (data.path !== null && !data.path.startsWith(`${actor.id}/`))
        throw new Invalid('photo', 'invalid');
      return { replaced: await setAvatarPath(db, actor.id, data.path) };
    },
  },
};

export type AccountActionName = keyof typeof accountActions;
