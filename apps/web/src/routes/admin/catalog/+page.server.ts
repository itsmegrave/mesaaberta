import type { CatalogKind } from '@mesaaberta/core/admin/catalog';
import type { Sort } from '@mesaaberta/core/admin/list';
import { requireAdmin } from '#lib/server/admin-access.js';
import { catalogActions } from '#lib/server/admin/catalog-actions.js';
import type {
  CATALOG_SORTS,
  CATALOG_STATUS_FILTERS,
  listApproved,
  listCatalogAdmin,
} from '@mesaaberta/core/server/admin/catalog';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { Actions, PageServerLoad } from './$types';

type CatalogPage = {
  kind: CatalogKind;
  query: string;
  status: (typeof CATALOG_STATUS_FILTERS)[number];
  sort: Sort<(typeof CATALOG_SORTS)[number]> | null;
  approved: Awaited<ReturnType<typeof listApproved>>[CatalogKind];
} & Awaited<ReturnType<typeof listCatalogAdmin>>;

// The api reads the console for the address's filters; a page past the last is its 404.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  return revivedDates(
    await readFromApi<CatalogPage>(locals, user.id, `/v1/admin-reads/catalog?${url.searchParams}`),
  );
};

export const actions: Actions = {
  create: catalogActions.create,
  rename: catalogActions.rename,
  merge: catalogActions.merge,
  disable: catalogActions.disable,
};
