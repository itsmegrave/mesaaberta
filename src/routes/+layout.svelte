<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { asset } from '$app/paths';
	import { localeNames, localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { baseLocale, getLocale, locales } from '$lib/paraglide/runtime';

	let { children } = $props();

	const locale = getLocale();
	const otherLocales = locales.filter((other) => other !== locale);
	const absolute = (other: (typeof locales)[number]) =>
		new URL(localizedHref(page.url.pathname, other), page.url.origin).href;
</script>

<svelte:head>
	<link rel="apple-touch-icon" sizes="180x180" href={asset('/apple-touch-icon.png')} />
	<link rel="icon" type="image/png" sizes="32x32" href={asset('/favicon-32x32.png')} />
	<link rel="icon" type="image/png" sizes="16x16" href={asset('/favicon-16x16.png')} />
	<link rel="manifest" href={asset('/site.webmanifest')} />
	{#each locales as other (other)}
		<link rel="alternate" hreflang={other} href={absolute(other)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={absolute(baseLocale)} />
</svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
>
	{m.skip_to_content()}
</a>

<header class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
	<a href={localizedHref('/', locale)} class="font-brand text-xl font-semibold tracking-wide">
		Mesa Aberta
	</a>
	<nav>
		{#each otherLocales as other (other)}
			<!-- A full page load, so the document language and every string switch together. -->
			<a
				href={localizedHref(page.url.pathname, other)}
				lang={other}
				hreflang={other}
				data-sveltekit-reload
				class="text-link"
			>
				{localeNames[other]}
			</a>
		{/each}
	</nav>
</header>

<main id="main" class="mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
	{@render children()}
</main>

<footer class="mx-auto w-full max-w-6xl px-4 md:px-8">
	<div class="border-t border-petrol/15 py-6 text-sm">
		<p>
			{m.footer_made_with()}
			<a href="https://github.com/itsmegrave" rel="noopener" class="text-link">itsmegrave</a>.
			{m.footer_open_source()}
			<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener" class="text-link">GitHub</a
			>.
		</p>
		<p class="mt-2">
			{m.footer_community()}
			<a href="https://linktr.ee/lenindragonsrpg" rel="noopener" class="text-link">Lenindragons</a>.
		</p>
	</div>
</footer>
