<script lang="ts">
	import PlayingCard from '$lib/components/PlayingCard.svelte';
	import RunningCard from '$lib/components/RunningCard.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const locale = getLocale();
	// Every action posted from here comes back here.
	const next = localizedHref('/account/tables', locale);
</script>

<svelte:head>
	<title>{m.dash_title()}</title>
</svelte:head>

<section class="py-10 md:py-12">
	<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
		<h1 class="text-5xl leading-none font-semibold tracking-tight md:text-6xl">{m.dash_title()}</h1>
		<div class="flex flex-col gap-3 sm:flex-row">
			<a href={localizedHref('/tables', locale)} class="btn preset-outlined-primary-500 py-3.5"
				>{m.dash_find_table()}</a
			>
			<a
				href={localizedHref('/tables/new', locale)}
				class="btn gap-2.5 preset-filled-primary-500 py-3.5"
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
					aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
				>
				{m.tables_open_cta()}
			</a>
		</div>
	</div>

	<div class="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-12">
		<section aria-labelledby="playing">
			<div class="flex items-baseline gap-3">
				<h2 id="playing" class="text-3xl font-semibold">{m.dash_playing()}</h2>
				<span class="text-sm font-semibold text-surface-700-300">{data.playing.length}</span>
			</div>
			{#if data.playing.length === 0}
				<p class="mt-3">{m.dash_playing_empty()}</p>
				<a href={localizedHref('/tables', locale)} class="mt-2 inline-block anchor">
					{m.dash_find_table()}
				</a>
			{:else}
				<ul class="mt-4 grid gap-4">
					{#each data.playing as item (item.slug)}
						<li><PlayingCard {item} {next} /></li>
					{/each}
				</ul>
			{/if}
		</section>

		<section aria-labelledby="running">
			<div class="flex items-baseline gap-3">
				<h2 id="running" class="text-3xl font-semibold">{m.dash_running()}</h2>
				<span class="text-sm font-semibold text-surface-700-300">{data.running.length}</span>
			</div>
			{#if data.running.length === 0}
				<p class="mt-3">{m.dash_running_empty()}</p>
				<a href={localizedHref('/tables/new', locale)} class="mt-2 inline-block anchor">
					{m.tables_open_cta()}
				</a>
			{:else}
				<ul class="mt-4 grid gap-4">
					{#each data.running as item (item.slug)}
						<li><RunningCard {item} {next} /></li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</section>
