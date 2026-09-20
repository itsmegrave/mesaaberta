<script lang="ts">
	import TableCard from '$lib/components/TableCard.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const listHref = localizedHref('/tables', getLocale());
</script>

<svelte:head>
	<title>{m.tables_title()}</title>
	<meta name="description" content={m.tables_description()} />
</svelte:head>

<section class="py-10 md:py-16">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.tables_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.tables_lede()}</p>
	<a
		href={localizedHref('/tables/new', getLocale())}
		class="mt-6 inline-block rounded bg-petrol px-5 py-3 font-semibold text-on-petrol"
	>
		{m.tables_open_cta()}
	</a>

	<!-- A plain GET form: it filters without JavaScript, and the URL can be shared. -->
	<form method="GET" action={listHref} class="mt-8 flex max-w-xl flex-wrap items-end gap-3">
		<div class="min-w-0 grow">
			<label for="system" class="block text-sm font-semibold">{m.tables_filter_label()}</label>
			<select
				id="system"
				name="system"
				class="mt-1 block w-full rounded border border-petrol/30 bg-surface px-3 py-2"
			>
				<option value="">{m.tables_filter_all()}</option>
				{#each data.systems as system (system.slug)}
					<option value={system.slug} selected={system.slug === data.selected}>
						{system.name}
					</option>
				{/each}
			</select>
		</div>
		<button type="submit" class="rounded bg-petrol px-4 py-2 font-semibold text-on-petrol">
			{m.tables_filter_apply()}
		</button>
	</form>

	{#if data.tables.length > 0}
		<ul class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.tables as table (table.slug)}
				<li><TableCard {table} /></li>
			{/each}
		</ul>
	{:else}
		<div class="mt-10 max-w-[44ch]" role="status">
			<p class="text-lg">{data.selected ? m.tables_empty_filtered() : m.tables_empty()}</p>
			{#if data.selected}
				<a href={listHref} class="mt-3 inline-block text-link">{m.tables_filter_clear()}</a>
			{/if}
		</div>
	{/if}
</section>
