import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import type { PageServerLoad } from './$types';

// The admin area has one section so far; `/admin` (the link in the account menu) opens it.
export const load: PageServerLoad = async ({ locals }) => {
  await requireAdmin(locals);
  redirect(307, '/admin/notifications');
};
