<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  // A count on a bell, a tab, a nav item or a launcher: "3", or "9+" past `max` unless `capped` is
  // off. Nothing shows at zero. Pass `aria-hidden` when the label beside it already says the number,
  // or an `aria-label` when not.
  let {
    count,
    max = 9,
    capped = true,
    tone = 'warning',
    class: className = '',
    ...attributes
  }: HTMLAttributes<HTMLSpanElement> & {
    count: number;
    max?: number;
    /** Off, the badge shows the whole number however large. */
    capped?: boolean;
    tone?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | 'surface';
  } = $props();

  // Whole class names, so Tailwind finds them.
  const tones = {
    primary: 'preset-filled-primary-500',
    secondary: 'preset-filled-secondary-500',
    tertiary: 'preset-filled-tertiary-500',
    success: 'preset-filled-success-500',
    warning: 'preset-filled-warning-500',
    error: 'preset-filled-error-700',
    surface: 'preset-filled-surface-500',
  };
</script>

{#if count > 0}
  <span
    {...attributes}
    class="badge rounded-full text-xs font-bold tabular-nums {tones[tone]} {className}"
    >{capped && count > max ? `${max}+` : count}</span
  >
{/if}
