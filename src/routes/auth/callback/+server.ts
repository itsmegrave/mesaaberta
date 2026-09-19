import { redirect } from '@sveltejs/kit';
import { finishLogin } from '$lib/server/auth/login';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.supabase) redirect(303, '/login?error=unavailable');

	const target = await finishLogin(
		{ supabase: locals.supabase, db: locals.db, log: locals.log },
		{ code: url.searchParams.get('code'), next: url.searchParams.get('next') }
	);

	redirect(303, target);
};
