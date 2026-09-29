<script lang="ts" module>
  export type SkeletonKind = 'cards' | 'columns' | 'rows';
</script>

<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  /**
   * Stands in for a slow list: table cards (/tables), the dashboard's two columns (/account/tables),
   * or notification rows. With `heading`, also the page title, when the whole page is on its way.
   */
  let { kind, heading = false }: { kind: SkeletonKind; heading?: boolean } = $props();

  const pulse = 'bg-surface-200-800 motion-safe:animate-pulse';
  const shape = `rounded-lg ${pulse}`;
</script>

<div role="status" aria-busy="true" class={heading ? 'pt-2 pb-4 md:pt-12' : 'mt-8'}>
  <span class="sr-only">{m.nav_loading()}</span>
  <div aria-hidden="true">
    {#if heading}
      <div data-skeleton-heading class="mb-8 grid gap-3">
        <div class="h-10 w-2/3 md:h-16 md:w-1/2 {shape}"></div>
        <div class="h-6 w-5/6 md:w-1/3 {shape}"></div>
      </div>
    {/if}

    {#if kind === 'cards'}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {#each { length: 6 }, index (index)}
          <div
            data-skeleton-item
            class="flex min-h-96 flex-col overflow-hidden rounded-lg border border-surface-200-800"
          >
            <div class="h-36 {pulse}"></div>
            <div class="grid gap-3 p-5">
              <div class="h-6 w-3/4 {shape}"></div>
              <div class="h-4 w-full {shape}"></div>
              <div class="h-4 w-2/3 {shape}"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if kind === 'columns'}
      <div class="grid gap-10 lg:grid-cols-2 lg:gap-12">
        {#each { length: 2 }, column (column)}
          <div class="grid gap-5">
            <div class="h-9 w-1/2 {shape}"></div>
            {#each { length: 2 }, index (index)}
              <div data-skeleton-item class="h-40 {shape}"></div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid gap-2">
        {#each { length: 5 }, index (index)}
          <div data-skeleton-item class="h-20 {shape}"></div>
        {/each}
      </div>
    {/if}
  </div>
</div>
