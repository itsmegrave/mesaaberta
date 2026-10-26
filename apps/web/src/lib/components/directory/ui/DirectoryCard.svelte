<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { linkedCardClass } from '#lib/components/ui/MediaCard.svelte';

  /**
   * A card of a directory list (systems, places, quem mestra): the mark, the name as the card's one
   * link, a line of facts, an optional row of people, and a footer with what is open now and the
   * arrow. The name's link stretches over the whole card (see `linkedCardClass`).
   */
  let {
    href,
    name,
    facts,
    mark,
    people,
    status,
    active = false,
  }: {
    href: string;
    name: string;
    /** One muted line under the name ("41 mesas na Mesa Aberta · 12 pessoas mestram"). */
    facts: string;
    mark: Snippet;
    /** The row between the name and the footer (an AvatarStack). */
    people?: Snippet;
    /** The footer's words ("6 mesas abertas", "Nenhuma mesa aberta agora"). */
    status: string;
    /** Something is open now: the status reads in the lamp colour. */
    active?: boolean;
  } = $props();
</script>

<article class="{linkedCardClass} min-w-0 gap-4 p-5">
  <div class="flex items-start gap-4">
    {@render mark()}
    <div class="min-w-0">
      <h3 class="text-xl leading-tight font-semibold tracking-tight text-balance">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
        <a {href} class="no-underline after:absolute after:inset-0 focus-visible:outline-none"
          >{name}</a
        >
      </h3>
      <p class="mt-1.5 text-sm font-medium text-muted">{facts}</p>
    </div>
  </div>
  {@render people?.()}
  <div class="mt-auto flex items-center justify-between gap-3 border-t border-surface-200-800 pt-4">
    <span class="font-semibold {active ? 'text-lamp' : 'text-muted'}">{status}</span>
    <span
      aria-hidden="true"
      class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-wash"
    >
      <Icon name="chevron-right" size={18} />
    </span>
  </div>
</article>
