import { execFileSync } from 'node:child_process';

/** What the local Supabase stack answers to `supabase status`: its URLs and keys. All public demo values. */
export type Stack = {
	API_URL: string;
	DB_URL: string;
	PUBLISHABLE_KEY: string;
	SECRET_KEY: string;
	MAILPIT_URL: string;
};

let cached: Stack | undefined;

/**
 * The running local stack (`pnpm e2e:up`). Read once from the Supabase CLI, so nothing about ports or
 * keys is written down in two places. Throws a clear message when the stack is not running.
 */
export function stack(): Stack {
	if (cached) return cached;

	try {
		const out = execFileSync('node_modules/.bin/supabase', ['status', '-o', 'json'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		cached = JSON.parse(out) as Stack;
		return cached;
	} catch {
		throw new Error(
			'The local Supabase is not running. Start it with `pnpm e2e:up` (it needs Docker).'
		);
	}
}
