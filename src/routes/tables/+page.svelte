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

<section class="py-10 md:py-12">
	<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
		<div>
			<h1 class="text-5xl leading-none font-semibold tracking-tight md:text-6xl">
				{m.tables_title()}
			</h1>
			<p class="mt-4 max-w-[46ch] text-lg text-surface-700-300 md:text-xl">{m.tables_lede()}</p>
		</div>
		<a
			href={localizedHref('/tables/new', getLocale())}
			class="btn shrink-0 gap-2.5 py-3.5 preset-filled-primary-500"
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

	<!-- A plain GET form: it filters without JavaScript, and the URL can be shared. -->
	<form
		method="GET"
		action={listHref}
		class="mt-9 flex flex-wrap items-end gap-3 border-y border-surface-200-800 py-6"
	>
		<div class="min-w-0 grow md:max-w-xl">
			<label for="system" class="block text-sm font-semibold text-surface-700-300"
				>{m.tables_filter_label()}</label
			>
			<select id="system" name="system" class="select mt-2 w-full">
				<option value="">{m.tables_filter_all()}</option>
				{#each data.systems as system (system.slug)}
					<option value={system.slug} selected={system.slug === data.selected}>
						{system.name}
					</option>
				{/each}
			</select>
		</div>
		<button type="submit" class="btn preset-filled-primary-500">
			{m.tables_filter_apply()}
		</button>
	</form>

	{#if data.tables.length > 0}
		<ul class="mt-8 grid gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
			{#each data.tables as table (table.slug)}
				<li><TableCard {table} /></li>
			{/each}
		</ul>
	{:else}
		<div class="mt-10 max-w-[44ch]" role="status">
			<p class="text-lg">{data.selected ? m.tables_empty_filtered() : m.tables_empty()}</p>
			{#if data.selected}
				<a href={listHref} class="mt-3 inline-block anchor">{m.tables_filter_clear()}</a>
			{/if}
		</div>
	{/if}
</section>
