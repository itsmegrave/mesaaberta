import type { Handler } from '../events/types';
import type { SocialPublisher } from '../social/port';

/**
 * A feature that plugs into Mesa Aberta from outside the public code: Instagram today, more later
 * (Trello #207). An extension fills only the points it uses. The public code reads extensions from
 * `installed.ts` and never names one, so a build without any still compiles and runs.
 *
 * Runtime-neutral like the rest of core: the delivery graph, the api and the background Worker all
 * load this, so nothing here may pull in SvelteKit, Svelte components or `Bun.*`.
 */
export interface Extension {
  /** Stable and unique. Never rename one that has shipped: URLs and settings will use it. */
  readonly id: string;
  /** A social network that tables are announced on (ADR 0001/0007). */
  readonly social?: SocialPublisher;
  /** Event handlers of its own, besides its connector's. Names are stored in `handledBy`. */
  readonly handlers?: readonly Handler[];
}
