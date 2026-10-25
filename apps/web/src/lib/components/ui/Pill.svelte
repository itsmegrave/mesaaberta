<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A short status or kind next to a title: filled in the primary colour, the waiting colour, or
   * an outline. `class` adds placement (`shrink-0`).
   */
  let {
    tone = 'primary',
    class: className = '',
    children,
  }: { tone?: 'primary' | 'warning' | 'outline'; class?: string; children: Snippet } = $props();

  const tones = {
    primary: 'preset-filled-primary-500',
    warning: 'bg-warning-status text-surface-50-950',
    outline: 'border border-surface-200-800',
  };
</script>

<span class="chip h-6 rounded-full {tones[tone]} px-3 text-xs font-semibold {className}"
  >{@render children()}</span
>
