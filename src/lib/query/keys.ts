export const resources = [
  'preview',
  'tables',
  'detail',
  'dashboard',
  'manage',
  'catalog',
  'editCatalog',
  'account',
  'admin',
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
  'detail',
  'dashboard',
  'manage',
  'account',
  'catalog',
  'editCatalog',
  'admin',
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
  return params.toString();
}
