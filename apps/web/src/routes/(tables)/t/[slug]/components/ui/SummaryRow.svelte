<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * One fact of a summary list: the label in the first of three columns, the value across the other
   * two, a rule under both. The caller's `<dl>` is the `grid-cols-3` grid; `class` lays out the value.
   */
  let {
    label,
    class: className = '',
    children,
  }: { label: string; class?: string; children: Snippet } = $props();
</script>

<dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
  {label}
</dt>
<dd class="col-span-2 border-b border-surface-200-800 py-3 {className}">
  {@render children()}
</dd>
