import { getContext, setContext } from 'svelte';
import type { QueryClient } from '@tanstack/svelte-query';
import { createQueryClient } from './client';
const key = Symbol('mesa-query-client');
export function provideQueryClient(client: QueryClient) {
  setContext(key, client);
}
/** Isolated component previews/tests get a local cache too; production uses the root client. */
export function queryClient() {
  return getContext<QueryClient | undefined>(key) ?? createQueryClient();
}
