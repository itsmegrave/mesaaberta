<script lang="ts">
  import Chair from './Chair.svelte';
  import { m } from '#lib/paraglide/messages.js';

  // On the blue panel of the sign-in pages the tabletop is a shade instead of blue, the lamp's pool
  // of light is white, and the empty chair takes the light lamp colours.
  let { onBrand = false }: { onBrand?: boolean } = $props();

  // Two illustrations may share a page, and a gradient's id must be unique in the document.
  const lampId = $props.id();

  const centre = 200;

  // The map's grid: 20px squares inside its 120 x 100 frame (x 140-260, y 150-250).
  const gridLines = [
    ...[160, 180, 200, 220, 240].map((x) => `M${x} 150V250`),
    ...[170, 190, 210, 230].map((y) => `M140 ${y}H260`),
  ].join('');

  // The chairs sit on a ring around the table, 60° apart, each turned to face it. The empty one is
  // in the top-right, where the logo keeps its open seat too.
  const orbit = 150;

  const at = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: +(centre + orbit * Math.cos(radians)).toFixed(1),
      y: +(centre + orbit * Math.sin(radians)).toFixed(1),
      turn: degrees + 90,
    };
  };

  const players = [
    { angle: -90, colour: 'fill-success-500 stroke-success-500' },
    { angle: 30, colour: 'fill-tertiary-400 stroke-tertiary-400' },
    { angle: 90, colour: 'fill-secondary-300 stroke-secondary-300' },
    { angle: 150, colour: 'fill-success-500 stroke-success-500' },
    { angle: 210, colour: 'fill-tertiary-400 stroke-tertiary-400' },
  ].map((player) => ({ ...player, ...at(player.angle) }));

  const emptySeat = at(-30);
</script>

<svg
  viewBox="0 0 400 400"
  role="img"
  aria-label={m.table_illustration_label()}
  class="mx-auto h-auto w-full max-w-md"
>
  <defs>
    <radialGradient id={lampId} cx={centre} cy={centre} r="190" gradientUnits="userSpaceOnUse">
      <stop offset="0.45" class={onBrand ? 'lamp-stop-brand' : 'lamp-stop'} />
      <stop offset="1" class={onBrand ? 'lamp-stop-brand' : 'lamp-stop'} stop-opacity="0" />
    </radialGradient>
  </defs>
  <!-- The lamp over the table: a pool of light that fades out past the chairs. -->
  <circle cx={centre} cy={centre} r="190" fill="url(#{lampId})" />
  <circle
    cx={centre}
    cy={centre}
    r="104"
    class={onBrand ? 'fill-surface-950/25' : 'table-top fill-primary-500'}
  />
  <!-- A battle map on the table: a square grid, two miniatures on it, and a d20 beside it. -->
  <g transform="rotate(-12 {centre} {centre})">
    <rect x="140" y="150" width="120" height="100" rx="6" class="fill-primary-contrast-500" />
    <path d={gridLines} class="stroke-primary-500/35" stroke-width="1.5" />
    <!-- A wall across the map, so it reads as a dungeon, not a spreadsheet. -->
    <path d="M160 170h40v20" class="fill-none stroke-surface-950/55" stroke-width="4" />
    <circle cx="190" cy="220" r="7" class="fill-success-500" />
    <circle cx="230" cy="180" r="7" class="fill-tertiary-400" />
  </g>
  <g transform="translate(262 238) rotate(14)">
    <path d="M0-15 13-7.5v15L0 15-13 7.5v-15z" class="fill-warning-400" />
    <path
      d="M0-15 7.5 5h-15zM-13 7.5 -7.5 5M13 7.5 7.5 5M0 15V5"
      class="fill-none stroke-warning-950/60"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </g>

  {#each players as player, i (player.angle)}
    <g transform="translate({player.x} {player.y}) rotate({player.turn})">
      <Chair data-seat={i} colour={player.colour} />
    </g>
  {/each}

  <g transform="translate({emptySeat.x} {emptySeat.y}) rotate({emptySeat.turn})">
    <Chair
      data-seat={players.length}
      colour={onBrand ? 'stroke-warning-300 fill-warning-500/15' : 'stroke-lamp fill-lamp-wash'}
      head="ring"
    />
  </g>
</svg>

<style>
  /* Lamp light: the warm wash of the layout tokens in light and dark, white on the blue panel. */
  .lamp-stop {
    stop-color: light-dark(
      color-mix(in oklab, var(--color-warning-500) 26%, transparent),
      color-mix(in oklab, var(--color-warning-400) 16%, transparent)
    );
  }

  .lamp-stop-brand {
    stop-color: color-mix(in oklab, white 12%, transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    svg :global([data-seat]) {
      transform-box: fill-box;
      transform-origin: center;
      animation: sit 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      animation-delay: calc(var(--i) * 110ms + 150ms);
    }

    /* The seat number reaches the CSS through an attribute, not an inline `style`, because the
		   Content-Security-Policy blocks inline styles. One rule per seat: five players and one empty. */
    svg :global([data-seat='0']) {
      --i: 0;
    }
    svg :global([data-seat='1']) {
      --i: 1;
    }
    svg :global([data-seat='2']) {
      --i: 2;
    }
    svg :global([data-seat='3']) {
      --i: 3;
    }
    svg :global([data-seat='4']) {
      --i: 4;
    }
    svg :global([data-seat='5']) {
      --i: 5;
    }
  }

  @keyframes sit {
    from {
      opacity: 0;
      transform: scale(0.55);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* The tabletop keeps its blue identity while lifting in dark mode. */
  :global([data-mode='dark']) .table-top {
    fill: var(--color-primary-400);
  }
</style>
