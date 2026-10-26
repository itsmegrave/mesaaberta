import { browser } from '$app/env';
import { refreshAll } from '$app/navigation';
import { getContext, setContext } from 'svelte';
import { createQuery, type QueryClient } from '@tanstack/svelte-query';
import { apiRead, ApiError } from '#lib/api/http.js';
import { queryClient } from '#lib/query/context.js';
import type { AdminCounts } from './sections';

export const ADMIN_COUNTS_KEY = ['admin-counts'] as const;
export const NO_COUNTS: AdminCounts = {
  reports: 0,
  queue: 0,
  connections: 0,
  events: 0,
  partners: 0,
  places: 0,
};

const key = Symbol('admin-counts');

/**
 * The admin layout's counts, kept fresh: read again every 30 seconds while the tab is visible and
 * when it comes back into focus, like the bell. Each layout load hands its newer numbers to the
 * poll. The admin pages read them with `adminCounts()`.
 */
export function provideAdminCounts(
  seed: () => AdminCounts | undefined,
  client: QueryClient = queryClient(),
) {
  const query = createQuery(
    () => ({
      queryKey: ADMIN_COUNTS_KEY,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        try {
          return await apiRead<AdminCounts>('/api/admin/counts', signal);
        } catch (cause) {
          // No longer an admin (or signed out): reload, and the admin layout answers 404.
          if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
            void refreshAll();
          throw cause;
        }
      },
      initialData: seed(),
      enabled: browser && !!seed(),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }),
    () => client,
  );
  // A layout load (after an action, say) counted again: it replaces what the poll last read.
  $effect.pre(() => {
    const counts = seed();
    if (counts) client.setQueryData(ADMIN_COUNTS_KEY, counts);
  });
  const live = {
    get current() {
      return query.data ?? seed() ?? NO_COUNTS;
    },
  };
  setContext(key, live);
  return live;
}

/** The live counts under the admin layout; outside it (a component on its own), the page's data. */
export function adminCounts(fallback: () => AdminCounts | undefined) {
  const live = getContext<{ current: AdminCounts } | undefined>(key);
  return {
    get current() {
      return live?.current ?? fallback() ?? NO_COUNTS;
    },
  };
}
