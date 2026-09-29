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
      flags: import('$lib/server/flags/flags').Flags;
      /** Set while the `maintenance_mode` flag is on: `bypass` for an admin, `blocked` for anyone else. */
      maintenance?: 'blocked' | 'bypass';
      /** Logs with this request's id already attached. */
      log: import('$lib/server/logger').Logger;
      /** The database, or null while none is configured (see `handleDatabase`). */
      db: import('$lib/server/db/client').Db | null;
      /** Runs `task` after the response, with the request's database, before the connection closes. */
      afterResponse: (task: (db: import('$lib/server/db/client').Db) => Promise<unknown>) => void;
      /** Supabase Auth with cookie sessions, or null while it is not configured. */
      supabase: import('@supabase/supabase-js').SupabaseClient | null;
      /** The signed-in user, verified with Supabase (never read from the cookie). Null if anonymous. */
      getUser: () => Promise<import('@supabase/supabase-js').User | null>;
      /** The signed-in user's profile, which is the actor for `can()`. Null if anonymous or without one. */
      getProfile: () => Promise<
        typeof import('$lib/server/db/schema').profiles.$inferSelect | null
      >;
      /** Set once someone is signed in; it ends up on the request log line. */
      userId?: string;
    }
    interface PageData {
      cacheIdentity?: string;
      /** The zone every time is shown in, from the root layout (see `viewerTimezone`). */
      viewer?: import('$lib/time/timezone').ViewerTimezone;
    }
    // interface PageState {}
  }
}

export {};
