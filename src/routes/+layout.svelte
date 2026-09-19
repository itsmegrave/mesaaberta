<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
>
	Skip to content
</a>

<header class="border-b border-stone-200">
	<div class="mx-auto flex h-14 max-w-5xl items-center px-4">
		<a href={resolve('/')} class="text-lg font-semibold">Mesa Aberta</a>
	</div>
</header>

<main id="main" class="mx-auto w-full max-w-5xl px-4 py-6">
	{@render children()}
</main>
