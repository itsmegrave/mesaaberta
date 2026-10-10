import type { InstagramEnv } from '../instagram/api';
import { configured } from '../instagram/api';
import {
  instagramQueueHandler,
  publishInstagramPosts,
  publishInstagramTable,
  queueInstagramTable,
} from '../instagram/publisher';
import type { SocialPublisher } from './port';

/** The Instagram connector: the existing publisher behind the port, unchanged. */
export const instagramSocial: SocialPublisher = {
  name: 'instagram',
  configured: (env) => configured(env as InstagramEnv | undefined),
  queueTable: (db, env, tableId, now) =>
    queueInstagramTable(db, env as InstagramEnv | undefined, tableId, now),
  publishTable: (db, env, tableId, now, options) =>
    publishInstagramTable(db, env as InstagramEnv | undefined, tableId, now, options),
  publishDue: (db, env, now) => publishInstagramPosts(db, env as InstagramEnv | undefined, now),
  // Always registered, even before OAuth is configured: creation events stay decoupled from Meta.
  handlers: [instagramQueueHandler],
};
