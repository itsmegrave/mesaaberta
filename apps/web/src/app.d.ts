// Generated global Workers types (`wrangler types`). A reference is required: the file is a
// global declaration script, not a module, so `import` does not apply. Loaded here instead of
// through tsconfig `types`, whose file-path form TypeScript 7 rejects.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- a global declaration script cannot import
/// <reference path="../worker-configuration.d.ts" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      /**
       * The host's variables and bindings, or undefined when the host provides none. Server code
       * reads this, never `platform.env`: `handleRuntime` is the one place that knows the host.
       */
      env: Platform['env'] | undefined;
      /** What the host offers beyond variables (see `handleRuntime`). Read this, never `platform.ctx`. */
      host: import('$lib/server/runtime').Host;
      flags: import('@mesaaberta/core/server/flags/flags').Flags;
      /** Set while the `maintenance_mode` flag is on: `bypass` for an admin, `blocked` for anyone else. */
      maintenance?: 'blocked' | 'bypass';
      /** Logs with this request's id already attached. */
      log: import('@mesaaberta/core/server/logger').Logger;
      /** The database, or null while none is configured (see `handleDatabase`). */
      db: import('@mesaaberta/core/server/db/client').Db | null;
      /** Runs `task` after the response, with the request's database, before the connection closes. */
      afterResponse: (
        task: (db: import('@mesaaberta/core/server/db/client').Db) => Promise<unknown>,
      ) => void;
      /** Queues a product event for the signed-in person, sent after the response. See `createTracker`. */
      track: import('@mesaaberta/core/server/analytics/track').Track;
      /** Supabase Auth with cookie sessions, or null while it is not configured. */
      supabase: import('@supabase/supabase-js').SupabaseClient | null;
      /** The signed-in user, verified with Supabase (never read from the cookie). Null if anonymous. */
      getUser: () => Promise<import('@supabase/supabase-js').User | null>;
      /** The signed-in user's profile, which is the actor for `can()`. Null if anonymous or without one. */
      getProfile: () => Promise<
        typeof import('@mesaaberta/core/server/db/schema').profiles.$inferSelect | null
      >;
      /** Whether `api_events_fenced_leases` is on for this request's person (read once, lazily). */
      fencedLeases?: () => Promise<boolean>;
      /** Whether `api_events_queue_shadow` is on for this request's person (read once, lazily). */
      queueShadow?: () => Promise<boolean>;
      /** The handler names this request hands to the queue (one `api_events_queue_*` flag per class); usually none. */
      queueLive?: () => Promise<readonly string[]>;
      /** Set once someone is signed in; it ends up on the request log line. */
      userId?: string;
    }
    interface PageData {
      cacheIdentity?: string;
      /** What the pages say about this deployment, from the root layout (see `siteOf`). */
      site?: import('@mesaaberta/config').PublicConfig;
      /** The zone every time is shown in, from the root layout (see `viewerTimezone`). */
      viewer?: import('@mesaaberta/core/time/timezone').ViewerTimezone;
    }
    // interface PageState {}
  }
}

export {};
