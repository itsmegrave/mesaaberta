<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  // On the blue panel of the sign-in pages the tabletop is a shade instead of blue, and the lamp
  // colours are the light ones.
  let { onBrand = false }: { onBrand?: boolean } = $props();

  const centre = 200;

  // The map's grid: 20px squares inside its 120 x 100 frame (x 140-260, y 150-250).
  const gridLines = [
    ...[160, 180, 200, 220, 240].map((x) => `M${x} 150V250`),
    ...[170, 190, 210, 230].map((y) => `M140 ${y}H260`),
  ].join('');
  const orbit = 150;

  const at = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return {
      x: +(centre + orbit * Math.cos(radians)).toFixed(1),
      y: +(centre + orbit * Math.sin(radians)).toFixed(1),
    };
  };

  const players = [
    { angle: -90, colour: 'fill-success-500' },
    { angle: -30, colour: 'fill-tertiary-400' },
    { angle: 90, colour: 'fill-secondary-300' },
    { angle: 150, colour: 'fill-success-500' },
    { angle: 210, colour: 'fill-tertiary-400' },
  ].map((player) => ({ ...player, ...at(player.angle) }));

  const emptySeat = at(30);
</script>

<svg
  viewBox="0 0 400 400"
  role="img"
  aria-label={m.table_illustration_label()}
  class="mx-auto h-auto w-full max-w-md"
>
  <circle
    cx={centre}
    cy={centre}
    r="186"
    class="fill-none {onBrand ? 'stroke-warning-300' : 'stroke-lamp'}"
    stroke-opacity="0.28"
    stroke-width="2"
  />
  <circle
    cx={centre}
    cy={centre}
    r="104"
    class={onBrand ? 'fill-black/25' : 'table-top fill-primary-500'}
  />
  <!-- A battle map on the table: a square grid, two miniatures on it, and a d20 beside it. -->
  <g transform="rotate(-12 {centre} {centre})">
    <rect x="140" y="150" width="120" height="100" rx="6" class="fill-white" />
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
    <g transform="translate({player.x} {player.y})">
      <g data-seat={i}>
        <circle r="24" class={player.colour} />
        <circle r="9" cy="-2" class="fill-surface-950/25" />
      </g>
    </g>
  {/each}

  <g transform="translate({emptySeat.x} {emptySeat.y})">
    <g data-seat={players.length}>
      <circle
        r="28"
        class={onBrand ? 'fill-warning-500/15 stroke-warning-300' : 'fill-lamp-wash stroke-lamp'}
        stroke-width="3.5"
        stroke-dasharray="7 8"
      />
    </g>
  </g>
</svg>

<style>
  @media (prefers-reduced-motion: no-preference) {
    [data-seat] {
      transform-box: fill-box;
      transform-origin: center;
      animation: sit 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      animation-delay: calc(var(--i) * 110ms + 150ms);
    }

    /* The seat number reaches the CSS through an attribute, not an inline `style`, because the
		   Content-Security-Policy blocks inline styles. One rule per seat: five players and one empty. */
    [data-seat='0'] {
      --i: 0;
    }
    [data-seat='1'] {
      --i: 1;
    }
    [data-seat='2'] {
      --i: 2;
    }
    [data-seat='3'] {
      --i: 3;
    }
    [data-seat='4'] {
      --i: 4;
    }
    [data-seat='5'] {
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
