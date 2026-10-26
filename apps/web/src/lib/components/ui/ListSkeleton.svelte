<script lang="ts" module>
  export type SkeletonKind = 'cards' | 'columns' | 'rows' | 'detail' | 'profile' | 'home' | 'admin';
</script>

<script lang="ts">
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import { m } from '#lib/paraglide/messages.js';

  /**
   * Stands in for a slow page, in the shape of what is coming (design system: Loading): cards for
   * the table list and the directories, the dashboard's two columns (/u/tables), rows for
   * notifications, conversations and the blog, `detail` for an item page (a table, a system, a
   * post: cover and text beside the side panel) and `profile` for a public profile (cover, photo,
   * name, stat tiles), `home` for the signed-in Início (greeting, the dashboard blocks beside Sua
   * conta, a row of cards) and `admin` for an Admin section (title, toolbar, table rows). With
   * `heading`, also the page title, when the whole page is on its way; the item shapes draw their
   * own title. With `nav`, `admin` also holds the place of the sections' column, for arriving from
   * outside Admin.
   */
  let {
    kind,
    heading = false,
    nav = false,
  }: { kind: SkeletonKind; heading?: boolean; nav?: boolean } = $props();
  const ownTitle = $derived(['detail', 'profile', 'home', 'admin'].includes(kind));

  const pulse = 'bg-surface-200-800 motion-safe:animate-pulse';
  const shape = `rounded-lg ${pulse}`;
</script>

<div
  role="status"
  aria-busy="true"
  class={kind === 'admin' && !nav
    ? ''
    : kind === 'home'
      ? 'pt-4 pb-8 md:pt-6 md:pb-10'
      : heading || ownTitle
        ? 'pt-2 pb-4 md:pt-8'
        : 'mt-8'}
>
  <span class="sr-only">{m.nav_loading()}</span>
  <div aria-hidden="true">
    {#if heading && !ownTitle}
      <div data-skeleton-heading class="mb-8 grid gap-3">
        <div class="h-9 w-2/3 md:h-12 md:w-1/2 {shape}"></div>
        <div class="h-6 w-5/6 md:w-1/3 {shape}"></div>
      </div>
    {/if}

    {#if kind === 'cards'}
      <CardGrid as="div">
        {#each { length: 6 }, index (index)}
          <div
            data-skeleton-item
            class="flex flex-col overflow-hidden rounded-lg border border-surface-200-800"
          >
            <div class="h-28 {pulse}"></div>
            <div class="grid gap-3 px-4 pt-4 pb-3">
              <div class="h-7 w-3/4 {shape}"></div>
              <div class="h-4 w-full {shape}"></div>
              <div class="h-4 w-2/3 {shape}"></div>
              <!-- The seats and the card's footer line. -->
              <div class="mt-2 h-11 {shape}"></div>
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
          <div class="h-9 w-3/4 md:h-12 {shape}"></div>
          <div class="h-5 w-1/2 {shape}"></div>
          <div data-skeleton-item class="mt-5 aspect-5/2 w-full {shape}"></div>
          <div class="mt-5 h-4 w-full {shape}"></div>
          <div class="h-4 w-full {shape}"></div>
          <div class="h-4 w-2/3 {shape}"></div>
        </div>
        <div
          data-skeleton-item
          class="grid content-start gap-4 self-start rounded-lg border border-surface-200-800 p-4 md:p-5"
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
    {:else if kind === 'home'}
      <div class="grid gap-6 md:gap-8">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="grid gap-2">
            <div class="h-9 w-2/3 md:h-12 md:w-96 {shape}"></div>
            <div class="h-6 w-5/6 md:w-80 {shape}"></div>
          </div>
          <div class="grid grid-cols-2 gap-2 md:flex md:gap-3">
            <div class="h-11 md:w-36 {shape}"></div>
            <div class="h-11 md:w-36 {shape}"></div>
          </div>
        </div>
        <!-- The Início cards fold: the first open, the rest closed to their 64px header. -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div class="grid content-start gap-4 md:col-span-2 md:gap-6">
            <div data-skeleton-item class="h-48 {shape}"></div>
            <div data-skeleton-item class="h-16 {shape}"></div>
          </div>
          <div class="grid content-start gap-4 md:gap-6">
            <div data-skeleton-item class="h-40 {shape}"></div>
            <div data-skeleton-item class="h-16 {shape}"></div>
          </div>
        </div>
        <div class="grid gap-4">
          <div class="h-7 w-1/2 md:h-8 md:w-1/4 {shape}"></div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            {#each { length: 3 }, index (index)}
              <div
                data-skeleton-item
                class="h-64 {index > 0 ? 'hidden md:block' : ''} {shape}"
              ></div>
            {/each}
          </div>
        </div>
      </div>
    {:else if kind === 'admin'}
      {#snippet section()}
        <div class="grid gap-6">
          <div class="h-4 w-1/4 {shape}"></div>
          <div class="h-9 w-1/2 md:h-12 md:w-1/3 {shape}"></div>
          <div class="flex gap-3">
            <div class="h-11 flex-1 md:max-w-sm {shape}"></div>
            <div class="h-11 w-32 {shape}"></div>
          </div>
          <div class="overflow-hidden rounded-lg border border-surface-200-800">
            <div class="h-11 {pulse}"></div>
            {#each { length: 8 }, index (index)}
              <div data-skeleton-item class="border-t border-surface-200-800 px-4 py-3">
                <div class="h-11 {shape}"></div>
              </div>
            {/each}
          </div>
        </div>
      {/snippet}
      {#if nav}
        <!-- The Admin layout: the sections' column (w-59, 236px) and the content 28px to its right. -->
        <div
          class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7"
        >
          <div data-skeleton-nav class="mt-5 hidden w-59 content-start gap-1 md:grid">
            {#each { length: 8 }, index (index)}
              <div class="h-11 {shape}"></div>
            {/each}
          </div>
          {@render section()}
        </div>
      {:else}
        {@render section()}
      {/if}
    {:else}
      <div class="grid gap-2">
        {#each { length: 5 }, index (index)}
          <div data-skeleton-item class="h-20 {shape}"></div>
        {/each}
      </div>
    {/if}
  </div>
</div>
