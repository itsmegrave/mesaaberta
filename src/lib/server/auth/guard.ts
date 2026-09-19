import { redirect } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

/**
 * Call at the top of a `load` or action that needs a signed-in user. Anonymous visitors are sent
 * to the login page and brought back to where they were going.
 */
export async function requireUser(locals: App.Locals, url: URL): Promise<User> {
	const user = await locals.getUser();
	if (user) return user;

	redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
}
