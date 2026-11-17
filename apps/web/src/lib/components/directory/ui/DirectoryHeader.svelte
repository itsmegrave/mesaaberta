<script lang="ts">
  import type { Snippet } from 'svelte';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';

  /**
   * The head of a directory item's page: the trail, the mark beside the name, the facts as chips
   * (the first in the lamp wash when it says what is open now) and the page's actions stacked on
   * the right (under it on a phone).
   */
  let {
    crumbs,
    name,
    facts,
    factsLabel,
    highlightFirst = false,
    mark,
    actions,
  }: {
    crumbs: { label: string; href?: string }[];
    name: string;
    facts: string[];
    /** What the chips are, for a screen reader ("Sobre o sistema"). */
    factsLabel: string;
    highlightFirst?: boolean;
    mark: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<Breadcrumbs class="mb-8" items={crumbs} />
<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
  <div class="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:gap-7">
    {@render mark()}
    <div class="min-w-0">
      <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
        {name}
      </h1>
      {#if facts.length > 0}
        <ul aria-label={factsLabel} class="mt-4 flex flex-wrap gap-2">
          {#each facts as fact, index (fact)}
            <li
              class="inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold {index ===
                0 && highlightFirst
                ? 'bg-lamp-wash'
                : 'bg-surface-wash'}"
            >
              {fact}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-col gap-3">{@render actions()}</div>
  {/if}
</div>
