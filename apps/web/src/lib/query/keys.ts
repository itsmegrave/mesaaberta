import { tableFilters } from '@mesaaberta/core/admin/table-filters';
import { profileFilters } from '@mesaaberta/core/admin/profile-filters';
import {
  readSystemDirectoryFilters,
  systemDirectoryQuery,
} from '@mesaaberta/core/systems/directory-filters';
import { gmDirectoryQuery, readGmDirectoryFilters } from '@mesaaberta/core/gms/directory-filters';

export const resources = [
  'preview',
  'home',
  'tables',
  'detail',
  'dashboard',
  'manage',
  'catalog',
  'editCatalog',
  'account',
  'admin',
  'adminUsers',
  'adminTables',
  'systems',
  'system',
  'gamemasters',
] as const;
export type Resource = (typeof resources)[number];
export type ReadSeed = {
  resource: Resource;
  params: string;
  viewer: string;
  updatedAt: number;
  fields: string[];
};
export const privateResources = new Set<Resource>([
  'home',
  'detail',
  'dashboard',
  'manage',
  'account',
  'catalog',
  'editCatalog',
  'admin',
  'adminUsers',
  'adminTables',
]);
export function readKey(seed: Pick<ReadSeed, 'resource' | 'viewer' | 'params'>) {
  return [
    'api',
    seed.resource,
    privateResources.has(seed.resource) ? seed.viewer : 'public',
    seed.params,
  ] as const;
}
export const staleTime = (resource: Resource) => (resource === 'catalog' ? 300_000 : 15_000);
/** Canonical keys: multi-select ordering must not create duplicate caches. */
export function readParams(resource: Resource, url: URL, slug?: string) {
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (resource === 'tables')
    for (const name of ['system', 'platform', 'tag']) {
      for (const value of [...new Set(url.searchParams.getAll(name))].sort())
        params.append(name, value);
    }
  if (resource === 'tables' && url.searchParams.has('modality'))
    params.set('modality', url.searchParams.getAll('modality').at(-1)!);
  // A page of "Minhas mesas" is its own cache entry; the first page has no parameter.
  if (resource === 'dashboard' && url.searchParams.has('page'))
    params.set('page', url.searchParams.get('page')!);
  // The systems directory: one entry per filtered page, defaults left out (`systemDirectoryQuery`).
  if (resource === 'systems') {
    const filters = readSystemDirectoryFilters(url.searchParams);
    for (const [key, value] of new URLSearchParams(systemDirectoryQuery(filters, filters.page)))
      params.set(key, value);
  }
  // Quem mestra: the same, with `gmDirectoryQuery`.
  if (resource === 'gamemasters') {
    const filters = readGmDirectoryFilters(url.searchParams);
    for (const [key, value] of new URLSearchParams(gmDirectoryQuery(filters, filters.page)))
      params.set(key, value);
  }
  if (resource === 'adminUsers' || resource === 'adminTables') {
    const filters =
      resource === 'adminTables'
        ? tableFilters(url.searchParams)
        : profileFilters(url.searchParams);
    params.set('status', filters.status);
    if ('instagram' in filters) params.set('instagram', filters.instagram);
    params.set('q', filters.query);
    params.set('sort', filters.sort.id);
    params.set('dir', filters.sort.dir);
    params.set('page', String(filters.page));
    params.set('size', String(filters.pageSize));
  }
  return params.toString();
}
