<script lang="ts">
	let { size = 34, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" class="shrink-0 {className}">
	<circle cx="17" cy="17" r="10.5" class="fill-primary-500" />
	<circle cx="17" cy="4.6" r="3.4" class="fill-success-500" />
	<circle cx="28.6" cy="22" r="3.4" class="fill-error-500" />
	<circle cx="6.4" cy="24" r="3.4" class="fill-tertiary-500" />
	<circle
		cx="28"
		cy="9"
		r="2.8"
		fill="none"
		class="stroke-warning-500"
		stroke-width="1.6"
		stroke-dasharray="2.6 2.6"
	/>
</svg>
