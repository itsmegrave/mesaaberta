<script lang="ts">
	const centre = 200;
	const orbit = 150;

	const at = (degrees: number) => {
		const radians = (degrees * Math.PI) / 180;
		return {
			x: +(centre + orbit * Math.cos(radians)).toFixed(1),
			y: +(centre + orbit * Math.sin(radians)).toFixed(1)
		};
	};

	const players = [
		{ angle: -90, colour: 'fill-sage' },
		{ angle: -30, colour: 'fill-rose' },
		{ angle: 90, colour: 'fill-periwinkle' },
		{ angle: 150, colour: 'fill-sage' },
		{ angle: 210, colour: 'fill-rose' }
	].map((player) => ({ ...player, ...at(player.angle) }));

	const emptySeat = at(30);
</script>

<svg
	viewBox="0 0 400 400"
	role="img"
	aria-label="Mesa de RPG vista de cima, com cinco jogadores sentados e uma cadeira vazia"
	class="mx-auto h-auto w-full max-w-md"
>
	<circle cx={centre} cy={centre} r="186" class="fill-none stroke-lamp/20" stroke-width="2" />
	<circle cx={centre} cy={centre} r="104" class="fill-petrol" />
	<g transform="rotate(-12 {centre} {centre})">
		<rect x="152" y="170" width="96" height="60" rx="4" class="fill-celadon" />
		<path d="M164 190h44M164 202h60M164 214h30" class="stroke-petrol/40" stroke-width="3" />
	</g>

	{#each players as player, i (player.angle)}
		<g transform="translate({player.x} {player.y})">
			<g data-seat style="--i: {i}">
				<circle r="24" class={player.colour} />
				<circle r="9" cy="-2" class="fill-petrol/25" />
			</g>
		</g>
	{/each}

	<g transform="translate({emptySeat.x} {emptySeat.y})">
		<g data-seat style="--i: {players.length}">
			<circle r="28" class="fill-lamp/10 stroke-lamp" stroke-width="3.5" stroke-dasharray="7 8" />
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
</style>
