import { error } from '@sveltejs/kit';
import type { badgeCatalogAdmin } from '@mesaaberta/core/server/badges/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { requireAdmin } from '#lib/server/admin-access.js';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { PageServerLoad } from './$types';

// Every badge with how many hold it and how many were taken away. Granting and revoking happen on
// the person's page. `use_badges` off for the admin hides the section.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  const profile = (await locals.getProfile())!;
  if (!(await badgesEnabled(locals, profile))) error(404, 'Not found');
  return {
    badges: revivedDates(
      await readFromApi<Awaited<ReturnType<typeof badgeCatalogAdmin>>>(
        locals,
        profile.id,
        '/v1/admin-reads/badges',
      ),
    ),
  };
};
