<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import appleTouchIcon from '$lib/assets/apple-touch-icon.png';
	import favicon32 from '$lib/assets/favicon-32x32.png';
	import favicon16 from '$lib/assets/favicon-16x16.png';
	import manifest from '$lib/assets/site.webmanifest';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIcon} />
	<link rel="icon" type="image/png" sizes="32x32" href={favicon32} />
	<link rel="icon" type="image/png" sizes="16x16" href={favicon16} />
	<link rel="manifest" href={manifest} />
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
	<div class="border-t border-petrol/15 py-6 text-sm">
		<p>
			Feito com 💜 por
			<a href="https://github.com/itsmegrave" rel="noopener" class="text-link">itsmegrave</a>. Essa
			plataforma é open source e você pode conferir o código no
			<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener" class="text-link">GitHub</a
			>.
		</p>
		<p class="mt-2">
			Feito pela comunidade, para a comunidade. Conheça a
			<a href="https://linktr.ee/lenindragonsrpg" rel="noopener" class="text-link">Lenindragons</a>.
		</p>
	</div>
</footer>
