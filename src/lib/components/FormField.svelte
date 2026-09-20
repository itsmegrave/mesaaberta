<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		label,
		hint,
		error,
		children
	}: { id: string; label: string; hint?: string; error?: string; children: Snippet } = $props();
</script>

<div class="min-w-0">
	<label for={id} class="block font-semibold">{label}</label>
	{#if hint}<p id="{id}-hint" class="text-sm">{hint}</p>{/if}
	<div class="mt-1">{@render children()}</div>
	{#if error}<p id="{id}-error" role="alert" class="mt-1 text-sm font-semibold text-red-800">
			{error}
		</p>{/if}
</div>
