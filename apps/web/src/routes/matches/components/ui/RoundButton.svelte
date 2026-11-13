<script lang="ts">
  import type { IconName } from '#lib/icons/names.js';
  import Icon from '#lib/components/ui/Icon.svelte';
  import D20 from './D20.svelte';

  // The deck's answer buttons: chunky stickers with an ink outline and a hard shadow.
  let {
    icon,
    d20,
    label,
    kind,
    big = false,
    disabled = false,
    onclick,
  }: {
    icon?: IconName;
    /** A d20 showing this face instead of an icon (20 is yes, 1 is no). */
    d20?: number;
    label: string;
    kind: 'yes' | 'no' | 'undo' | 'more';
    big?: boolean;
    disabled?: boolean;
    onclick: () => void;
  } = $props();

  const LOOK = {
    yes: 'bg-punk-pink -rotate-3',
    no: 'bg-punk-paper rotate-3',
    undo: 'bg-punk-yellow -rotate-6',
    more: 'bg-success-500 rotate-6',
  } as const;
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
  class="inline-flex shrink-0 items-center justify-center rounded-full border-punk-ink text-punk-ink transition-transform hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500 active:translate-0.5 disabled:opacity-50 {LOOK[
    kind
  ]} {big
    ? 'size-18 border-4 shadow-[4px_4px_0_var(--color-punk-ink)]'
    : 'size-13 border-3 shadow-[3px_3px_0_var(--color-punk-ink)]'}"
>
  {#if d20}
    <D20 face={d20} size={big ? 54 : 36} />
  {:else if icon}
    <Icon name={icon} size={big ? 34 : 24} class="**:stroke-3" />
  {/if}
</button>
