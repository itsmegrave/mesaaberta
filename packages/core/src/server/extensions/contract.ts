import type { ZodType } from 'zod';
import type { AnyDb } from '../db/client';
import type { Handler } from '../events/types';
import type { SocialPublisher } from '../social/port';

/**
 * Saves what an OAuth handshake produced, through the admin action of that name. The host decides
 * whether the api Worker or this process runs it; the extension only names the action and its data.
 */
export type SaveAction = (action: string, data: Record<string, string>) => Promise<void>;

/** Connecting an external account from the admin: the browser leaves for `origin` and comes back. */
export interface OAuthConnection {
  /** The origin the authorize page lives on, so the redirect may leave the app. */
  readonly origin: string;
  /** Whether the deployment has the credentials to start the handshake. */
  configured(env: object | undefined): boolean;
  /** The page to send the admin to. `state` is checked when they come back. */
  authorizeUrl(env: object | undefined, state: string): URL;
  /** Trades the code for the account and saves it with `save`. Throws on any failure. */
  complete(env: object | undefined, code: string, save: SaveAction): Promise<void>;
}

/** What an admin does by hand with an extension, by name (the web form and the api route run these). */
export type AdminAction = {
  schema: ZodType;
  apply(db: AnyDb, env: never, data: never): Promise<Record<string, unknown>>;
};

/** A file the network fetches without cookies, such as the image of a post. */
export type PublicAsset = { body: Uint8Array<ArrayBuffer>; type: string };

/**
 * A feature that plugs into Mesa Aberta from outside the public code: Instagram today, more later
 * (Trello #207, #208). An extension fills only the points it uses. The public code reads extensions
 * from `installed.ts` and never names one, so a build without any still compiles and runs.
 *
 * Runtime-neutral like the rest of core: the delivery graph, the api and the background Worker all
 * load this, so nothing here may pull in SvelteKit, Svelte components or `Bun.*`.
 */
export interface Extension {
  /**
   * Stable and unique: it is the URL segment (`/admin/<id>`, `/<id>/assets/...`). Never rename one
   * that has shipped, and reserve it as a username, because a profile lives at `/u/<username>`.
   */
  readonly id: string;
  /** A social network that tables are announced on (ADR 0001/0007). */
  readonly social?: SocialPublisher;
  /** Event handlers of its own, besides its connector's. Names are stored in `handledBy`. */
  readonly handlers?: readonly Handler[];
  /** Connecting its account from the admin. */
  readonly oauth?: OAuthConnection;
  /** Its admin hand actions, run by the web form and by the api Worker's route. */
  readonly adminActions?: Readonly<Record<string, AdminAction>>;
  /** Looks up a public asset by key, or null when there is none (or it expired). */
  asset?(db: AnyDb, key: string): Promise<PublicAsset | null>;
}
