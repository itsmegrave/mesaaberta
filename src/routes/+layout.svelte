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
	Pular para o conteúdo
</a>

<header class="mx-auto flex h-16 w-full max-w-6xl items-center px-4 md:px-8">
	<a href={resolve('/')} class="font-brand text-xl font-semibold tracking-wide">Mesa Aberta</a>
</header>

<main id="main" class="mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
	{@render children()}
</main>

<footer class="mx-auto w-full max-w-6xl px-4 md:px-8">
	<p class="border-t border-petrol/15 py-6 text-sm">
		Mesa Aberta é um projeto de código aberto, em construção.
	</p>
</footer>
