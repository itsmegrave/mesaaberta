import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/http';
export const retryRead = (count: number, error: Error) =>
  count < 2 && (!(error instanceof ApiError) || error.status >= 500);
/** Called per SSR request/component tree, never a process-global authenticated cache. */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 300_000,
        retry: retryRead,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}
