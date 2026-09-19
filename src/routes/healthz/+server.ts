import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Liveness probe for uptime checks. It says the Worker is serving requests; the database check
// is added with the database itself (#5).
export const GET: RequestHandler = () =>
	json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
