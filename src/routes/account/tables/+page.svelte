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

<section class="py-10 md:py-16">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.dash_title()}</h1>

	<div class="mt-10 grid gap-12 lg:grid-cols-2">
		<section aria-labelledby="playing">
			<h2 id="playing" class="text-2xl font-semibold">{m.dash_playing()}</h2>
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
			<h2 id="running" class="text-2xl font-semibold">{m.dash_running()}</h2>
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
