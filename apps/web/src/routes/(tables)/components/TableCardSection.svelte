<script lang="ts">
  import { page } from '$app/state';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';
  import { tick, type ComponentProps } from 'svelte';

  type Table = ComponentProps<typeof TableCard>['table'];

  /**
   * One folding section of the table list ("Começa já", "Todas as mesas"): the first `limit` cards,
   * then a "Ver mais N mesas" card that shows the rest in place. Goes inside an MAAccordion.
   * `priority`: this is the page's first section, so its first cover loads first.
   */
  let {
    value,
    title,
    summary,
    icon,
    tables,
    limit = 3,
    priority = false,
  }: {
    value: string;
    title: string;
    summary: string;
    icon?: IconName;
    tables: Table[];
    limit?: number;
    priority?: boolean;
  } = $props();

  let expanded = $state(false);
  const shown = $derived(expanded ? tables : tables.slice(0, limit));
  const hidden = $derived(tables.length - shown.length);
  let grid = $state<HTMLElement>();

  // The button goes away with the click: focus moves to the first card it revealed.
  async function showAll() {
    expanded = true;
    await tick();
    grid?.querySelectorAll('li')[limit]?.querySelector<HTMLElement>('a')?.focus();
  }
</script>

<MAAccordionItem {value} {title} {summary} {icon} titleClass="text-xl font-semibold">
  <div bind:this={grid}>
    <CardGrid>
      {#each shown as table, i (table.slug)}
        <li>
          <TableCard
            {table}
            markBeginners={page.data.beginners}
            level="h3"
            priority={priority && i === 0}
          />
        </li>
      {/each}
      {#if hidden > 0}
        <li>
          <button
            type="button"
            class="flex size-full min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-300-700 p-6 font-semibold text-link hover:preset-tonal focus-visible:ring-2 focus-visible:ring-warning-500"
            onclick={showAll}
          >
            <Icon name="game-icons:dice-twenty-faces-twenty" size={32} />
            {m.tables_show_more({ count: hidden })}
          </button>
        </li>
      {/if}
    </CardGrid>
  </div>
</MAAccordionItem>
