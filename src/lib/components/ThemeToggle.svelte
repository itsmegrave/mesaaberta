<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { applyChoice, readChoice, type ThemeChoice } from '$lib/theme/theme';

	// The server cannot know the choice (it lives in the browser), so start on "system" and read it on mount.
	let choice = $state<ThemeChoice>('system');

	onMount(() => (choice = readChoice()));
</script>

<label class="flex items-center gap-2 text-sm">
	<span class="sr-only">{m.theme_label()}</span>
	<select
		bind:value={choice}
		onchange={() => applyChoice(choice)}
		class="rounded border border-petrol/30 bg-surface px-2 py-1"
	>
		<option value="system">{m.theme_system()}</option>
		<option value="light">{m.theme_light()}</option>
		<option value="dark">{m.theme_dark()}</option>
	</select>
</label>
