<script lang="ts">
	let { size = 34, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" class="shrink-0 {className}">
	<circle cx="17" cy="17" r="10.5" class="fill-primary-500" />
	<!-- The battle map on the tabletop, as in the big illustration: a small gridded square. -->
	<g transform="rotate(-12 17 17)">
		<rect x="11" y="12" width="12" height="10" rx="1.2" class="fill-white" />
		<path
			d="M15 12v10M19 12v10M11 15.3h12M11 18.7h12"
			class="stroke-primary-500/55"
			stroke-width="0.8"
		/>
	</g>
	<circle cx="17" cy="4.6" r="3.4" class="fill-success-500" />
	<circle cx="28.6" cy="22" r="3.4" class="fill-tertiary-400" />
	<circle cx="6.4" cy="24" r="3.4" class="fill-secondary-300" />
	<circle
		cx="28"
		cy="9"
		r="2.8"
		fill="none"
		class="stroke-lamp"
		stroke-width="1.6"
		stroke-dasharray="2.6 2.6"
	/>
</svg>
