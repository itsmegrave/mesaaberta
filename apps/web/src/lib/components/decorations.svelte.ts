import { createQuery } from '@tanstack/svelte-query';
import { browser } from '$app/env';
import type { PersonDecorations } from '@mesaaberta/core/server/extensions/contract';
import { decorates } from '#lib/extensions/load-decoration.js';
import { queryClient } from '#lib/query/context.js';
import { decorationKey, loadDecorations } from '#lib/query/decorations.js';

/**
 * A person's decorations, read in the browser after the page draws (batched with the other avatars
 * on the page). Undefined until they arrive, and always in a build that has no decoration
 * component.
 */
export function personDecorations(username: () => string | null | undefined) {
  const client = queryClient();
  const query = createQuery(
    () => {
      const name = username()?.trim().toLowerCase() ?? '';
      return {
        queryKey: decorationKey(name),
        queryFn: () => loadDecorations(name),
        enabled: browser && decorates() && name.length > 0,
        staleTime: 5 * 60_000,
        retry: false,
      };
    },
    () => client,
  );
  return {
    get current(): PersonDecorations | undefined {
      return query.data;
    },
  };
}
