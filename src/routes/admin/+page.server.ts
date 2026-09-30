import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The admin area has one section so far; `/admin` (the link in the account menu) opens it.
export const load: PageServerLoad = () => redirect(307, '/admin/notifications');
