<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';

  // A badge drawn as a rosette medal with two ribbon tails: the game-icon, or a short `mark` such as
  // "100!", on the disc. Locked, it is a grey outline with a dashed rim. Decorative: the name next to
  // it, or the button around it, says which badge it is.
  let {
    icon,
    mark,
    size = 56,
    locked = false,
    class: className = '',
  }: {
    icon: IconName;
    /** Drawn on the disc instead of the icon. Keep it to four characters. */
    mark?: string;
    size?: number;
    locked?: boolean;
    class?: string;
  } = $props();

  // A 48-unit box: the rosette is centred at (24, 21) and the ribbons hang below it to the bottom edge.
  const rosette =
    'M24 3.4A3.4 3.4 0 0 1 30.7 4.7A3.4 3.4 0 0 1 36.4 8.6A3.4 3.4 0 0 1 40.3 14.3A3.4 3.4 0 0 1 41.6 21A3.4 3.4 0 0 1 40.3 27.7A3.4 3.4 0 0 1 36.4 33.4A3.4 3.4 0 0 1 30.7 37.3A3.4 3.4 0 0 1 24 38.6A3.4 3.4 0 0 1 17.3 37.3A3.4 3.4 0 0 1 11.6 33.4A3.4 3.4 0 0 1 7.7 27.7A3.4 3.4 0 0 1 6.4 21A3.4 3.4 0 0 1 7.7 14.3A3.4 3.4 0 0 1 11.6 8.6A3.4 3.4 0 0 1 17.3 4.7A3.4 3.4 0 0 1 24 3.4Z';
  const ribbons = [
    'M16 31L10.5 46L15.5 43.5L18.5 47.5L23 34Z',
    'M32 31L37.5 46L32.5 43.5L29.5 47.5L25 34Z',
  ];
</script>

<span
  class="relative inline-flex shrink-0 {locked
    ? 'text-muted'
    : 'text-primary-contrast-500'} {className}"
  aria-hidden="true"
  data-badge-medal={locked ? 'locked' : 'earned'}
>
  <svg width={size} height={size} viewBox="0 0 48 48">
    {#if locked}
      {#each ribbons as ribbon (ribbon)}
        <path d={ribbon} class="fill-surface-200-800 stroke-surface-500" stroke-width="1" />
      {/each}
      <path
        d={rosette}
        class="fill-surface-200-800 stroke-surface-500"
        stroke-width="1.5"
        stroke-dasharray="3 2"
      />
    {:else}
      {#each ribbons as ribbon (ribbon)}
        <path d={ribbon} class="fill-primary-700" />
      {/each}
      <path d={rosette} class="fill-primary-700" />
      <circle cx="24" cy="21" r="15" class="fill-primary-500" />
      <circle
        cx="24"
        cy="21"
        r="13.2"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.4"
        stroke-width="1.25"
      />
    {/if}
    {#if mark}
      <text
        x="24"
        y="21"
        dy="0.35em"
        text-anchor="middle"
        font-size="11.5"
        font-weight="800"
        textLength="20"
        lengthAdjust="spacingAndGlyphs"
        fill="currentColor">{mark}</text
      >
    {/if}
  </svg>
  {#if !mark}
    <!-- Centred on the disc: 42 of the 48 units, so the middle lands on its centre at 21. -->
    <span class="absolute inset-x-0 top-0 flex h-[87.5%] items-center justify-center">
      <Icon name={icon} size={Math.round(size * 0.42)} />
    </span>
  {/if}
</span>
