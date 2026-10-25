<script lang="ts">
  // The mark is the hero illustration (TableIllustration) reduced to a 32-unit grid: the table with
  // its map, three players as dots on the diagonals, and the open seat as a ring in the top-right.
  // The monogram drops the map and the colours for the sizes where they turn to noise; it draws in
  // the current text colour. static/favicon.svg carries the same monogram for the browser tab.
  let {
    size = 32,
    variant = 'mark',
    class: className = '',
  }: { size?: number; variant?: 'mark' | 'monogram'; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="shrink-0 {className}">
  {#if variant === 'monogram'}
    <circle cx="16" cy="16" r="7" class="fill-current" />
    <circle cx="8.05" cy="8.05" r="3.75" class="fill-current" />
    <circle cx="23.95" cy="23.95" r="3.75" class="fill-current" />
    <circle cx="8.05" cy="23.95" r="3.75" class="fill-current" />
    <circle cx="23.95" cy="8.05" r="2.9" class="fill-none stroke-current" stroke-width="1.7" />
  {:else}
    <circle cx="16" cy="16" r="7.25" class="table-top fill-primary-500" />
    <g transform="rotate(-12 16 16)">
      <rect x="11.5" y="12.25" width="9" height="7.5" rx="0.9" class="fill-primary-contrast-500" />
      <path
        d="M14.5 12.25v7.5M17.5 12.25v7.5M11.5 14.75h9M11.5 17.25h9"
        class="stroke-primary-500/50"
        stroke-width="0.75"
      />
    </g>
    <circle cx="7.87" cy="7.87" r="3.5" class="fill-success-500" />
    <circle cx="24.13" cy="24.13" r="3.5" class="fill-tertiary-400" />
    <circle cx="7.87" cy="24.13" r="3.5" class="fill-secondary-300" />
    <circle cx="24.13" cy="7.87" r="2.75" class="fill-none stroke-lamp" stroke-width="1.5" />
  {/if}
</svg>

<style>
  /* The tabletop keeps its blue identity while lifting in dark mode, as in the illustration. */
  :global([data-mode='dark']) .table-top {
    fill: var(--color-primary-400);
  }
</style>
