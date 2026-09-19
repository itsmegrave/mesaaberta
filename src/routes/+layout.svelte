<script lang="ts">
	import './layout.css';
	import { asset, resolve } from '$app/paths';
	import AccountMenu from '$lib/components/AccountMenu.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { children, data } = $props();

	const locale = getLocale();
</script>

<svelte:head>
	<link rel="apple-touch-icon" sizes="180x180" href={asset('/apple-touch-icon.png')} />
	<link rel="icon" type="image/png" sizes="32x32" href={asset('/favicon-32x32.png')} />
	<link rel="icon" type="image/png" sizes="16x16" href={asset('/favicon-16x16.png')} />
	<link rel="manifest" href={asset('/site.webmanifest')} />
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

	{#if data.account}
		<AccountMenu name={data.account.displayName} avatarUrl={data.account.avatarUrl} />
	{:else if data.authEnabled}
		<a href={resolve('/login')} class="rounded px-3 py-2 font-semibold hover:bg-petrol/10">
			{m.nav_sign_in()}
		</a>
	{/if}
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
