<script lang="ts" module>
  export type SkeletonKind = 'cards' | 'columns' | 'rows' | 'detail' | 'profile';
</script>

<script lang="ts">
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import { m } from '#lib/paraglide/messages.js';

  /**
   * Stands in for a slow page, in the shape of what is coming (design system: Loading): cards for
   * the table list and the directories, the dashboard's two columns (/u/tables), rows for
   * notifications, conversations and the blog, `detail` for an item page (a table, a system, a
   * post: cover and text beside the side panel) and `profile` for a public profile (cover, photo,
   * name, stat tiles). With `heading`, also the page title, when the whole page is on its way; the
   * item shapes draw their own title.
   */
  let { kind, heading = false }: { kind: SkeletonKind; heading?: boolean } = $props();

  const pulse = 'bg-surface-200-800 motion-safe:animate-pulse';
  const shape = `rounded-lg ${pulse}`;
</script>

<div
  role="status"
  aria-busy="true"
  class={heading || kind === 'detail' || kind === 'profile' ? 'pt-2 pb-4 md:pt-8' : 'mt-8'}
>
  <span class="sr-only">{m.nav_loading()}</span>
  <div aria-hidden="true">
    {#if heading && kind !== 'detail' && kind !== 'profile'}
      <div data-skeleton-heading class="mb-8 grid gap-3">
        <div class="h-10 w-2/3 md:h-16 md:w-1/2 {shape}"></div>
        <div class="h-6 w-5/6 md:w-1/3 {shape}"></div>
      </div>
    {/if}

    {#if kind === 'cards'}
      <CardGrid as="div">
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
      </CardGrid>
    {:else if kind === 'columns'}
      <div class="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {#each { length: 2 }, column (column)}
          <div class="grid gap-5">
            <div class="h-9 w-1/2 {shape}"></div>
            {#each { length: 2 }, index (index)}
              <div data-skeleton-item class="h-40 {shape}"></div>
            {/each}
          </div>
        {/each}
      </div>
    {:else if kind === 'detail'}
      <div class="grid gap-8 lg:grid-cols-3 lg:gap-16">
        <div class="grid min-w-0 content-start gap-3 lg:col-span-2">
          <div class="h-4 w-1/4 {shape}"></div>
          <div class="h-10 w-3/4 md:h-14 {shape}"></div>
          <div class="h-5 w-1/2 {shape}"></div>
          <div data-skeleton-item class="mt-5 aspect-5/2 w-full {shape}"></div>
          <div class="mt-5 h-4 w-full {shape}"></div>
          <div class="h-4 w-full {shape}"></div>
          <div class="h-4 w-2/3 {shape}"></div>
        </div>
        <div
          data-skeleton-item
          class="grid content-start gap-4 self-start rounded-lg border border-surface-200-800 p-6"
        >
          <div class="h-6 w-2/3 {shape}"></div>
          <div class="h-16 {shape}"></div>
          <div class="h-11 {shape}"></div>
        </div>
      </div>
    {:else if kind === 'profile'}
      <div class="grid gap-4">
        <div class="overflow-hidden rounded-lg border border-surface-200-800 bg-panel">
          <div data-skeleton-item class="aspect-4/1 w-full {pulse}"></div>
          <div class="flex items-end gap-4 px-6 pb-6 md:px-8 md:pb-8">
            <!-- The photo sits over the cover's bottom edge in a ring of the card, as on the profile. -->
            <span class="-mt-12 inline-flex shrink-0 rounded-full bg-panel p-1 md:-mt-16">
              <span class="size-24 rounded-full md:size-32 {pulse}"></span>
            </span>
            <div class="grid flex-1 gap-2">
              <div class="h-7 w-1/2 md:w-1/3 {shape}"></div>
              <div class="h-4 w-1/3 md:w-1/5 {shape}"></div>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          {#each { length: 3 }, index (index)}
            <div data-skeleton-item class="h-20 {shape}"></div>
          {/each}
        </div>
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
