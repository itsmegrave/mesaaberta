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

/** Instagram's caption limit, the strictest of the networks a connector may post to. */
export const SOCIAL_CAPTION_MAX = 2200;

/** Where the media of a post comes from: a public https address, or a file an admin uploaded. */
export type SocialMedia = { url: string } | { bytes: Uint8Array; type: string };

/** A post an admin writes by hand (an image or a video), not a table's announcement. */
export type SocialPostInput = { caption: string; media: SocialMedia; createdBy: string };

/** What the media turned out to be once the connector read it. */
export type SocialMediaKind = 'image' | 'video';

/**
 * What asking for a post did. Without `confirmed` nothing is saved: the connector reads the media
 * and answers what it would post, and to which account, for the person to confirm. A refusal names
 * the field and a code (`media`: `unreachable`, `too_large`, `unsupported`; `caption`: `too_long`).
 */
export type SocialPostAnswer =
  | { step: 'confirm'; account: string; kind: SocialMediaKind; bytes: number }
  | { status: 'queued'; id: string; kind: SocialMediaKind }
  | { status: 'unavailable' }
  | { invalid: { field: 'media' | 'caption'; code: string } };

/** Where a hand-written post stands. `permalink` once it is published. */
export type SocialPostStatus = {
  id: string;
  kind: SocialMediaKind;
  status: 'queued' | 'processing' | 'publishing' | 'published' | 'failed' | 'uncertain';
  permalink: string | null;
  lastError: string | null;
  createdAt: string;
};

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
  /** The network's name as the admin reads it ("Instagram"); without one, the capitalized `name`. */
  readonly label?: string;
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
  /**
   * A hand-written post (an image or a video), persisted for the background worker like a table's.
   * Optional: a connector without it answers `unavailable`.
   */
  queuePost?(
    db: AnyDb,
    env: object | undefined,
    input: SocialPostInput,
    options: { confirmed: boolean; now?: Date },
  ): Promise<SocialPostAnswer>;
  /** Where one hand-written post stands, or null for an id it never queued. */
  postStatus?(db: AnyDb, env: object | undefined, id: string): Promise<SocialPostStatus | null>;
  /** The event handlers this connector registers; they run whatever the credentials. */
  readonly handlers: readonly Handler[];
}
