import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { listPlaying, listRunning } from '$lib/server/dashboard/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	const now = new Date();
	const [playing, running] = await Promise.all([
		listPlaying(locals.db, user.id, now),
		listRunning(locals.db, user.id, now)
	]);

	return { playing, running };
};
