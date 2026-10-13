import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Plain HTML, no client-side router: from the screen, nothing navigates into the product.
export const csr = false;

// The screen exists only while the site is down; otherwise the address is not there.
export const load: PageServerLoad = async ({ locals }) => {
  if (!(await locals.flags.isEnabled('maintenance_mode'))) error(404);
};
