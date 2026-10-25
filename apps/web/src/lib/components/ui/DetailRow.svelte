<script lang="ts">
  import type { Snippet } from 'svelte';
  import { detailLayout } from './DetailList.svelte';

  // One fact of a DetailList: the muted label and its value. The value's classes go on the `<dd>`.
  let {
    label,
    class: className = '',
    children,
  }: { label: string; class?: string; children: Snippet } = $props();

  // `10rem`: a narrow label column, so a long value (a note, a list of links) keeps the width.
  const grids = {
    half: 'grid gap-1 py-3 sm:grid-cols-2',
    label: 'grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4',
  };
  const grid = grids[detailLayout()];
</script>

<div class={grid}>
  <dt class="text-sm font-semibold text-muted">{label}</dt>
  <dd class={className || undefined}>{@render children()}</dd>
</div>
