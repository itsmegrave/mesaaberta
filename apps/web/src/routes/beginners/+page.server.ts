import { requireBeginners } from '#lib/server/tables/beginners.js';
import type { PageServerLoad } from './$types';

// "Primeira mesa": the guide for people who never played, while `use_beginner_tables` is on.
export const load: PageServerLoad = async ({ locals }) => {
  await requireBeginners(locals);
  return {};
};
