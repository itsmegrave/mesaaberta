<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { onMount } from 'svelte';
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { apiRead } from '#lib/api/http.js';
  import { loadWidget } from '#lib/extensions/load-widget.js';
  import { widgets } from '#lib/extensions/panels.js';
  import { placementRoute, showsWidgets } from '#lib/extensions/widget-routes.js';
  import { queryClient } from '#lib/query/context.js';
  import { widgetsKey, type WidgetsResponse } from '#lib/query/widgets.js';
  import type { WidgetPayload } from '@mesaaberta/core/server/extensions/contract';

  /** Waits this long after the page loads, so a widget never greets someone before the page does. */
  const DELAY_MS = 3000;

  const client = queryClient();
  const routeId = $derived(placementRoute(page.route.id));
  const key = $derived(widgetsKey(routeId));
  // A build without widget components never asks.
  const installed = Object.keys(widgets).length > 0;

  let ready = $state(false);
  onMount(() => {
    const timer = setTimeout(() => (ready = true), DELAY_MS);
    return () => clearTimeout(timer);
  });

  const query = createQuery(
    () => ({
      queryKey: key,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRead<WidgetsResponse>(`/api/widgets?route=${encodeURIComponent(routeId ?? '')}`, signal),
      enabled: browser && installed && ready && showsWidgets(routeId),
      staleTime: 5 * 60_000,
      retry: false,
    }),
    () => client,
  );

  // One at a time: the first one this build has a component for.
  const shown = $derived(
    showsWidgets(routeId)
      ? query.data?.widgets.find(({ widget }) => Object.hasOwn(widgets, widget.kind))
      : undefined,
  );

  // An answered widget (a vote, "Agora não") never comes back: the page shows what the answer
  // returned, and every other page's cached list drops it, so it does not reappear on the way back.
  function answered(ext: string, id: string, next: WidgetPayload | null) {
    const update = (current: WidgetsResponse | undefined, keep: WidgetPayload | null) =>
      current && {
        widgets: current.widgets.flatMap((entry) =>
          entry.ext !== ext || entry.widget.id !== id
            ? [entry]
            : keep
              ? [{ ext, widget: keep }]
              : [],
        ),
      };
    client.setQueriesData<WidgetsResponse>(
      {
        queryKey: widgetsKey(null).slice(0, 1),
        predicate: (query) => query.queryKey[1] !== routeId,
      },
      (current) => update(current, null),
    );
    client.setQueryData<WidgetsResponse>(key, (current) => update(current, next));
  }
</script>

{#if shown}
  {@const { ext, widget } = shown}
  <!-- Bottom-left: the messages launcher and the toasts own bottom-right. On a phone it sits above
       the tab bar and stops short of the launcher (56px wide, 16px from the edge). -->
  <div class="fixed right-20 bottom-24 left-4 z-30 md:right-auto md:bottom-6 md:left-6 md:w-100">
    {#key widget.id}
      {#await loadWidget(widget.kind) then Widget}
        <Widget
          {widget}
          mode="card"
          action="/{ext}/w/{widget.id}?/respond"
          next={page.url.pathname + page.url.search}
          onAnswer={(next) => answered(ext, widget.id, next)}
        />
      {/await}
    {/key}
  </div>
{/if}
