import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/server/auth/safe-next';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (await locals.getUser()) redirect(303, next);

	// The `error` value is only a flag: it is never shown, so it cannot be used to inject text.
	return { next, failed: url.searchParams.has('error') };
};
