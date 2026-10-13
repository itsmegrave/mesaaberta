import type { QueryClient } from '@tanstack/svelte-query';
/** Invalidates the domain reads affected by a confirmed server action. Never submits a write. */
export async function afterWrite(client: QueryClient, domain: 'table' | 'account' | 'catalog') {
  const resources =
    domain === 'catalog'
      ? ['catalog', 'editCatalog', 'tables', 'detail', 'preview', 'manage', 'dashboard']
      : domain === 'table'
        ? ['tables', 'preview', 'detail', 'dashboard', 'manage', 'catalog', 'editCatalog']
        : [
            'account',
            'detail',
            'manage',
            'dashboard',
            'preview',
            'tables',
            'username',
            'catalog',
            'editCatalog',
          ];
  await client.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'api' && resources.includes(String(queryKey[1])),
  });
}
