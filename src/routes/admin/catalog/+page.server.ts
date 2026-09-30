import { error } from '@sveltejs/kit';
import { CATALOG_KINDS, pageNumber, type CatalogKind } from '$lib/admin/catalog';
import { requireAdmin } from '$lib/server/admin-access';
import { catalogActions } from '$lib/server/admin/catalog-actions';
import { listApproved, listCatalogAdmin } from '$lib/server/admin/catalog';
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

  const list = await listCatalogAdmin(locals.db, kind, { query, page });
  // A page past the last is a 404, the first page always exists.
  if (page > list.pages) error(404, 'Not found');

  return {
    kind,
    query,
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
