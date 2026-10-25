<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  // A count on a bell, a tab or a nav item: "3", or "9+" past `max`. Nothing shows at zero. Pass
  // `aria-hidden` when the label beside it already says the number, or an `aria-label` when not.
  let {
    count,
    max = 9,
    tone = 'warning',
    class: className = '',
    ...attributes
  }: HTMLAttributes<HTMLSpanElement> & {
    count: number;
    max?: number;
    tone?: 'warning' | 'error';
  } = $props();

  const tones = { warning: 'preset-filled-warning-500', error: 'preset-filled-error-500' };
</script>

{#if count > 0}
  <span
    {...attributes}
    class="badge rounded-full text-xs font-bold tabular-nums {tones[tone]} {className}"
    >{count > max ? `${max}+` : count}</span
  >
{/if}
