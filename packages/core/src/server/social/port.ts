import type { AnyDb } from '../db/client';
import type { Handler } from '../events/types';

/** Which connector a deployment uses: `instagram` (the default) or `none`. */
export type SocialEnv = { SOCIAL_PROVIDER?: string };

/** What asking to publish a table did: persisted for the background worker, or why not. */
export type QueueResult =
  'queued' | 'unavailable' | 'not-eligible' | 'already-published' | 'uncertain';

/** What publishing one table now did. */
export type PublishResult =
  'published' | 'processing' | 'uncertain' | 'unavailable' | 'not-eligible' | 'already-published';

/**
 * The port between the app and a social network that tables are announced on (ADR 0001/0007).
 * The domain asks for a table to be published; a connector decides how. A deployment without one
 * runs the `none` adapter, so the public code compiles and works with no network configured.
 *
 * Every method persists first and does the external write later, so a request never waits for the
 * network and a lost response never repeats a post.
 */
export interface SocialPublisher {
  readonly name: string;
  /** Whether the deployment has the credentials to publish at all. */
  configured(env: object | undefined): boolean;
  /** Persist a publication request for a table; the external write happens in the background. */
  queueTable(db: AnyDb, env: object | undefined, tableId: string, now?: Date): Promise<QueueResult>;
  /** Publish one eligible table now, on an explicit admin request. */
  publishTable(
    db: AnyDb,
    env: object | undefined,
    tableId: string,
    now?: Date,
    options?: { useTableImage?: boolean },
  ): Promise<PublishResult>;
  /** The cron's drain of queued publications. Returns how many it handled. */
  publishDue(db: AnyDb, env: object | undefined, now?: Date): Promise<number>;
  /** The event handlers this connector registers; they run whatever the credentials. */
  readonly handlers: readonly Handler[];
}
