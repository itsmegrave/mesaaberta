<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { applyChoice, readChoice, type ThemeChoice } from '$lib/theme/theme';

	let isDark = $state(false);
	let activeChoice = $state<ThemeChoice>('system');

	onMount(() => {
		const stored = readChoice();
		activeChoice = stored;
		if (stored === 'dark') {
			isDark = true;
		} else if (stored === 'light') {
			isDark = false;
		} else {
			// Follows the system until the first click
			isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}

		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (e: MediaQueryListEvent) => {
			if (activeChoice === 'system') {
				isDark = e.matches;
				applyChoice('system');
			}
		};
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	function handlePressedChange(pressed: boolean) {
		isDark = pressed;
		activeChoice = pressed ? 'dark' : 'light';
		applyChoice(activeChoice);
	}
</script>

<button
	type="button"
	aria-label="Tema escuro"
	aria-pressed={isDark}
	title={isDark ? m.theme_switch_to_light() : m.theme_switch_to_dark()}
	onclick={() => handlePressedChange(!isDark)}
	class="btn-icon size-11 shrink-0 rounded-full preset-tonal"
>
	{#if isDark}
		<!-- Sun icon (dark mode -> switch to light) -->
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			class="shrink-0"
		>
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"
			/>
		</svg>
	{:else}
		<!-- Moon icon (light mode -> switch to dark) -->
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			class="shrink-0"
		>
			<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
		</svg>
	{/if}
</button>
