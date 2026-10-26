<script lang="ts">
  // One Início card that folds (design system: Accordion), on phone and desktop. Its header names
  // the card and says what a closed one holds ("3 sessões · a próxima seg, 2 nov · 19:00"). It
  // starts open when it holds something to do now, closed otherwise.
  import type { Snippet } from 'svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';

  let {
    value,
    title,
    summary,
    open = false,
    count = 0,
    countLabel,
    aside,
    children,
  }: {
    value: string;
    title: string;
    summary?: string;
    /** How the card starts. */
    open?: boolean;
    /** Something that waits on the person: a badge beside the title. */
    count?: number;
    countLabel?: string;
    /** A link for the whole card ("Minhas mesas"), at the top of its content. */
    aside?: Snippet;
    children: Snippet;
  } = $props();

  // Only the first value counts: later loads (a refetch) don't fold a card the person opened.
  // svelte-ignore state_referenced_locally
  let shown = $state(open ? [value] : []);
</script>

<!-- Skeleton pads the header and content 16px on each side; 4px more on wide screens makes the
     cards' 20px. -->
<div class="rounded-lg border border-surface-200-800 bg-panel md:px-1">
  <MAAccordion bind:value={shown}>
    <MAAccordionItem
      {value}
      {title}
      {summary}
      {count}
      {countLabel}
      {aside}
      titleClass="text-lg font-semibold md:text-xl"
    >
      {@render children()}
    </MAAccordionItem>
  </MAAccordion>
</div>
