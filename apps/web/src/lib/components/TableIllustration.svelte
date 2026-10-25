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

  // Six chairs sit on a ring around the table, 60° apart, each turned to face it: the GM's at the
  // top (as on the table cards), the empty one next to it in the top-right, where the logo keeps its
  // open seat too, then four players.
  const orbit = 150;
  const step = 360 / 6;

  const at = (slot: number) => {
    const degrees = -90 + step * slot;
    const radians = (degrees * Math.PI) / 180;
    return {
      x: +(centre + orbit * Math.cos(radians)).toFixed(1),
      y: +(centre + orbit * Math.sin(radians)).toFixed(1),
      turn: +(degrees + 90).toFixed(1),
    };
  };

  const gmSeat = at(0);
  const emptySeat = at(1);
  const players = [
    'fill-success-500 stroke-success-500',
    'fill-tertiary-400 stroke-tertiary-400',
    'fill-secondary-300 stroke-secondary-300',
    'fill-success-500 stroke-success-500',
  ].map((colour, i) => ({ colour, ...at(i + 2) }));
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
  <!-- A d20 beside the map, drawn from arcticons:rpg-dice (48-unit grid): the outline, the faces
       around the front one, and the front face with its 20 (white on error-700, 5.2:1). Red on
       the blue table, so a white border keeps it apart: red and blue are about as light as each
       other, white on blue is 4.5:1. -->
  <g transform="translate(262 238) rotate(14) scale(0.85) translate(-24 -24)">
    <path
      d="m39.227 38.684 5.111-20.5L29.111 3.5 8.773 9.316l-5.111 20.5L18.889 44.5z"
      class="fill-error-500 stroke-surface-50"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path d="M33.729 34.984 10.254 29.13l16.934-17.916z" class="fill-error-700" />
    <path
      d="m39.227 38.684 5.111-20.5L29.111 3.5 8.773 9.316l-5.111 20.5L18.889 44.5zm-5.498-3.7 10.61-16.8-17.151-6.97L8.773 9.316l1.48 19.815L18.89 44.5zM33.729 34.984 10.254 29.13l16.934-17.916zm-6.541-23.77L29.111 3.5m4.618 31.484 5.498 3.7M10.254 29.13l-6.592.685"
      class="fill-none stroke-error-950/50"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <text
      x="23.7"
      y="28"
      text-anchor="middle"
      font-size="9"
      font-weight="700"
      class="fill-surface-50">20</text
    >
  </g>

  <g transform="translate({gmSeat.x} {gmSeat.y}) rotate({gmSeat.turn})">
    <Chair
      data-seat={0}
      colour={onBrand ? 'stroke-surface-950' : 'stroke-surface-950-50'}
      border={onBrand
        ? 'fill-surface-950 stroke-surface-50'
        : 'fill-surface-950-50 stroke-surface-50-950'}
    />
  </g>

  {#each players as player, i (i)}
    <g transform="translate({player.x} {player.y}) rotate({player.turn})">
      <Chair data-seat={i + 1} colour={player.colour} />
    </g>
  {/each}

  <g transform="translate({emptySeat.x} {emptySeat.y}) rotate({emptySeat.turn})">
    <Chair
      data-seat={players.length + 1}
      data-empty-seat
      colour={onBrand ? 'stroke-warning-300' : 'stroke-lamp'}
      free
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
		   Content-Security-Policy blocks inline styles. One rule per seat: the GM, four players and one empty. */
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
