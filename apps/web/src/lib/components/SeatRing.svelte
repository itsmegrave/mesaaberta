<script lang="ts">
  // A table seen from above with its chairs around it, drawn as the hero draws them. The first chair,
  // at the top, is the GM's (white, with a thin outline around the meeple), so a table with 5 seats shows 6 chairs; then the taken seats
  // clockwise in the seat colours, then the free ones as unfilled meeples in the light lamp colour.
  import Chair from './Chair.svelte';

  interface Props {
    capacity: number;
    seatsLeft: number;
    size?: number;
    label?: string;
    class?: string;
  }

  let { capacity = 5, seatsLeft = 0, size = 64, label, class: className = '' }: Props = $props();

  const SEAT_COLOURS = [
    'fill-success-500 stroke-success-500',
    'fill-tertiary-400 stroke-tertiary-400',
    'fill-secondary-300 stroke-secondary-300',
  ];

  const players = $derived(Math.max(1, capacity));
  const occupied = $derived(Math.max(0, players - Math.max(0, seatsLeft)));
  // The players' seats plus the GM's.
  const total = $derived(players + 1);
  // The hero's chair is 15 units of head on a 27-unit backrest; scaled so the ring fits the 100-unit box.
  const scale = $derived(((Math.min(9.5, Math.max(5, 75 / total)) / 15) * 0.75).toFixed(3));
  const orbitRadius = 32;

  const seats = $derived(
    Array.from({ length: total }, (_, i) => {
      const degrees = -90 + (360 * i) / total;
      const radians = (degrees * Math.PI) / 180;
      const x = (50 + orbitRadius * Math.cos(radians)).toFixed(1);
      const y = (50 + orbitRadius * Math.sin(radians)).toFixed(1);
      const colour =
        i === 0
          ? 'fill-primary-contrast-500 stroke-primary-contrast-500'
          : i <= occupied
            ? SEAT_COLOURS[(i - 1) % SEAT_COLOURS.length]
            : 'stroke-warning-300';
      return {
        transform: `translate(${x} ${y}) rotate(${degrees + 90}) scale(${scale})`,
        colour,
        free: i > occupied,
      };
    }),
  );
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 100 100"
  role="img"
  aria-label={label ?? `${occupied} de ${players} vagas ocupadas`}
  class="shrink-0 {className}"
>
  <!-- Central table surface -->
  <circle cx="50" cy="50" r="20" class="fill-surface-950/25" />

  {#each seats as seat, i (i)}
    <Chair transform={seat.transform} colour={seat.colour} free={seat.free} gm={i === 0} />
  {/each}
</svg>
