import { invalidateAll } from '$app/navigation';
import { browser } from '$app/environment';
import { createQuery, type QueryClient } from '@tanstack/svelte-query';
import { apiRead, ApiError } from '$lib/api/http';
import { queryClient } from './context';
import { readKey, staleTime, type ReadSeed } from './keys';

/** Seed from the authorized server load, then reconcile newer server navigations with the cache. */
export function pageQuery<T extends object>(
  source: () => T & { readSeed?: ReadSeed },
  client: QueryClient = queryClient(),
) {
  const query = createQuery(
    () => {
      const { readSeed, ...loaded } = source();
      const initial = readSeed
        ? Object.fromEntries(
            readSeed.fields.map((field) => [field, loaded[field as keyof typeof loaded]]),
          )
        : loaded;
      return {
        queryKey: readSeed ? readKey(readSeed) : ['ssr-preview'],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          try {
            return await apiRead<T>(
              `/api/query/${readSeed!.resource}?${readSeed!.params}`,
              signal,
              readSeed!.viewer,
            );
          } catch (cause) {
            if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
              client.removeQueries({ queryKey: readKey(readSeed!), exact: true });
              void invalidateAll();
            }
            throw cause;
          }
        },
        initialData: initial as T,
        initialDataUpdatedAt: readSeed?.updatedAt,
        enabled: browser && !!readSeed,
        staleTime: readSeed ? staleTime(readSeed.resource) : Infinity,
        // The loader just fetched this key. Focus/reconnect and invalidation still revalidate it.
        refetchOnMount: false,
      };
    },
    () => client,
  );
  $effect(() => {
    const { readSeed, ...data } = source();
    if (
      readSeed &&
      readSeed.updatedAt > (client.getQueryState(readKey(readSeed))?.dataUpdatedAt ?? 0)
    )
      client.setQueryData(
        readKey(readSeed),
        Object.fromEntries(
          readSeed.fields.map((field) => [field, data[field as keyof typeof data]]),
        ),
        { updatedAt: readSeed.updatedAt },
      );
  });
  return query;
}
