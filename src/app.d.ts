// Generated global Workers types (`wrangler types`). A reference is required: the file is a
// global declaration script, not a module, so `import` does not apply. Loaded here instead of
// through tsconfig `types`, whose file-path form TypeScript 7 rejects.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
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
			/** Logs with this request's id already attached. */
			log: import('$lib/server/logger').Logger;
			/** The database, or null while none is configured (see `handleDatabase`). */
			db: import('$lib/server/db/client').Db | null;
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
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
