import { error } from '@sveltejs/kit';
import { CATALOG_KINDS, pageNumber, type CatalogKind } from '$lib/admin/catalog';
import { pageSizeOf, sortOf, type Sort } from '$lib/admin/list';
import { requireAdmin } from '$lib/server/admin-access';
import { catalogActions } from '$lib/server/admin/catalog-actions';
import {
  CATALOG_PAGE_SIZE,
  CATALOG_SORTS,
  CATALOG_STATUS_FILTERS,
  listApproved,
  listCatalogAdmin,
} from '$lib/server/admin/catalog';
import { requireUser } from '$lib/server/auth/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  const asked = url.searchParams.get('kind');
  const kind: CatalogKind = CATALOG_KINDS.find((value) => value === asked) ?? 'platform';
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 40);
  const page = pageNumber(url.searchParams.get('page'));
  const statusAsked = url.searchParams.get('status');
  const status = CATALOG_STATUS_FILTERS.find((value) => value === statusAsked) ?? 'all';
  const pageSize = pageSizeOf(url.searchParams, CATALOG_PAGE_SIZE);
  // The catalog keeps its own order (the pickers' order) until a column is asked for.
  const sorted = url.searchParams.get('sort');
  const sort: Sort<(typeof CATALOG_SORTS)[number]> | null = CATALOG_SORTS.some(
    (value) => value === sorted,
  )
    ? sortOf(url.searchParams, CATALOG_SORTS, { id: 'name', dir: 'asc' })
    : null;

  const list = await listCatalogAdmin(locals.db, kind, { query, page, pageSize, status, sort });
  // A page past the last is a 404, the first page always exists.
  if (page > list.pages) error(404, 'Not found');

  return {
    kind,
    query,
    status,
    sort,
    ...list,
    approved: (await listApproved(locals.db))[kind],
  };
};

export const actions: Actions = {
  create: catalogActions.create,
  rename: catalogActions.rename,
  merge: catalogActions.merge,
  disable: catalogActions.disable,
};
