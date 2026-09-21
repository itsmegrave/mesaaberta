<script lang="ts">
	interface Props {
		capacity: number;
		seatsLeft: number;
		size?: number;
		class?: string;
	}

	let { capacity = 5, seatsLeft = 0, size = 64, class: className = '' }: Props = $props();

	const SEAT_COLORS = [
		'var(--color-success-500)',
		'var(--color-error-500)',
		'var(--color-tertiary-500)',
		'var(--color-warning-500)',
		'var(--color-secondary-500)',
		'var(--color-primary-500)'
	];

	const occupied = $derived(Math.max(0, capacity - Math.max(0, seatsLeft)));
	const total = $derived(Math.max(1, capacity));
	const seatRadius = $derived(Math.min(9.5, Math.max(5, 75 / total)));
	const orbitRadius = 37;

	const seats = $derived(
		Array.from({ length: total }, (_, i) => {
			const angle = -Math.PI / 2 + (2 * Math.PI * i) / total;
			const cx = 50 + orbitRadius * Math.cos(angle);
			const cy = 50 + orbitRadius * Math.sin(angle);
			const isOccupied = i < occupied;
			return {
				cx: Number(cx.toFixed(1)),
				cy: Number(cy.toFixed(1)),
				isOccupied,
				color: SEAT_COLORS[i % SEAT_COLORS.length]
			};
		})
	);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	role="img"
	aria-label="{occupied} de {total} vagas ocupadas"
	class="shrink-0 {className}"
>
	<!-- Central table surface -->
	<circle cx="50" cy="50" r="20" class="fill-surface-950/25" />

	<!-- Seats around the table -->
	{#each seats as seat (seat.cx + '-' + seat.cy)}
		{#if seat.isOccupied}
			<circle cx={seat.cx} cy={seat.cy} r={seatRadius} fill={seat.color} />
		{:else}
			<circle
				cx={seat.cx}
				cy={seat.cy}
				r={seatRadius}
				class="fill-warning-500/20 stroke-warning-500"
				stroke-width="2"
				stroke-dasharray="3 3"
			/>
		{/if}
	{/each}
</svg>
