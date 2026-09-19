import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST only, so a stray link or image cannot sign someone out. SvelteKit's origin check covers it.
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase?.auth.signOut();
	redirect(303, '/');
};
