<script lang="ts">
	import './layout.css';
	import { asset, resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import AccountMenu from '$lib/components/AccountMenu.svelte';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import TableLogo from '$lib/components/TableLogo.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { Progress } from '@skeletonlabs/skeleton-svelte';
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
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface-100-900 focus:px-3 focus:py-2 focus:text-surface-950-50 focus:shadow-md"
>
	{m.skip_to_content()}
</a>

<header
	class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:h-[88px] md:px-8"
>
	<a href={localizedHref('/', locale)} class="flex items-center gap-2.5 no-underline md:gap-3">
		<TableLogo size={34} class="size-7 md:size-[34px]" />
		<span class="font-brand text-[19px] font-semibold tracking-[0.04em] md:text-2xl">
			Mesa Aberta
		</span>
	</a>

	<nav class="flex items-center gap-2 md:gap-3" aria-label={m.nav_main()}>
		{#if data.released}
			<a
				href={localizedHref('/tables', locale)}
				class="btn hidden h-11 rounded-xl px-3.5 font-semibold hover:preset-tonal md:flex"
			>
				{m.nav_tables()}
			</a>
		{/if}

		{#if data.account}
			<a
				href={localizedHref('/account/tables', locale)}
				class="btn hidden h-11 rounded-xl px-3.5 font-semibold hover:preset-tonal md:flex"
			>
				{m.nav_my_tables()}
			</a>

			<a
				href={localizedHref('/tables/new', locale)}
				class="btn hidden h-11 gap-2.5 rounded-xl preset-filled-primary-500 px-4 md:inline-flex"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					class="shrink-0"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
				{m.nav_open_table()}
			</a>
		{/if}

		<ThemeToggle />

		{#if data.account}
			<AccountMenu
				name={data.account.displayName}
				avatarUrl={data.account.avatarUrl}
				isAdmin={data.account.isAdmin}
				pendingSuggestionsCount={data.account.pendingSuggestionsCount}
			/>
		{:else if data.authEnabled && data.released}
			<a href={resolve('/login')} class="btn h-11 rounded-xl preset-outlined-primary-500 px-4">
				{m.nav_sign_in()}
			</a>
		{/if}
	</nav>
</header>

<!-- Announced to screen readers and shown while a page's data loads, so a slow tap is not silent. -->
{#if navigating.to}
	<Progress value={null} class="fixed inset-x-0 top-0 z-50" aria-label={m.nav_loading()}>
		<Progress.Track class="h-1">
			<Progress.Range />
		</Progress.Track>
	</Progress>
{/if}

<Toaster />

<main id="main" class="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8 md:pb-16">
	{@render children()}
</main>

{#if data.released}
	<BottomTabBar isAdmin={data.account?.isAdmin} />
{/if}

<footer class="mx-auto w-full max-w-6xl px-4 md:px-8">
	<div
		class="grid gap-8 border-t border-surface-200-800 py-10 text-sm md:grid-cols-[1fr_auto] md:items-end"
	>
		<div>
			<p class="font-brand text-xl font-semibold tracking-[0.04em]">Mesa Aberta</p>
			<p class="mt-3 max-w-[45ch] text-surface-700-300">
				Uma plataforma aberta para encontrar pessoas, organizar sessões e manter a mesa viva.
			</p>
		</div>
		<div class="grid gap-2 md:text-right">
			<p>
				{m.footer_made_with()}
				<a href="https://github.com/itsmegrave" rel="noopener" class="anchor">itsmegrave</a>.
			</p>
			<p>
				{m.footer_open_source()}
				<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener" class="anchor">GitHub</a>.
			</p>
			<p>
				{m.footer_community()}
				<a href="https://linktr.ee/lenindragonsrpg" rel="noopener" class="anchor">Lenindragons</a>.
			</p>
		</div>
	</div>
</footer>
