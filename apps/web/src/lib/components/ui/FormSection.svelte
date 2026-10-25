<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';

  // A part of a long form: a panel named by its heading, with the step's number before it when the
  // form counts its parts, or an icon, and a line under it that says what the part is for.
  let {
    title,
    step,
    hint,
    icon,
    id: headingId,
    children,
  }: {
    title: string;
    /** The part's number, drawn in a badge before the heading. */
    step?: number;
    hint?: string;
    icon?: IconName;
    /** The heading's id, which names the section. */
    id?: string;
    children: Snippet;
  } = $props();

  const fallbackId = $props.id();
  const id = $derived(headingId ?? fallbackId);
</script>

<section aria-labelledby={id} class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8">
  {#if step}
    <div class="{hint ? 'mb-2' : 'mb-6'} flex items-center gap-3">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
        aria-hidden="true">{step}</span
      >
      <h2 {id} class="text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  {:else}
    <h2
      {id}
      class="{hint ? 'mb-2' : 'mb-6'} {icon
        ? 'flex items-center gap-2'
        : ''} text-2xl font-semibold tracking-tight"
    >
      {#if icon}<Icon name={icon} size={28} />{/if}{title}
    </h2>
  {/if}
  {#if hint}<p class="mb-6 text-muted">{hint}</p>{/if}
  <div class="grid gap-6">
    {@render children()}
  </div>
</section>
