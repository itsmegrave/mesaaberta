import { json } from '@sveltejs/kit';
import { checkDatabase } from '$lib/server/db/health';
import type { RequestHandler } from './$types';

// Liveness and dependency probe for uptime checks. 503 when the database is configured but does
// not answer; a deploy with no database configured yet still reports ok.
export const GET: RequestHandler = async ({ locals }) => {
	const database = await checkDatabase(locals.db, locals.log);
	const healthy = database !== 'down';

	return json(
		{ status: healthy ? 'ok' : 'error', database },
		{ status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
