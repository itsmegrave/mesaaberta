<script lang="ts">
	import TableCard from '$lib/components/TableCard.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const locale = getLocale();
	const listHref = localizedHref('/tables', locale);

	/** The list's query string with one filter changed and the other kept. */
	const query = (filters: { system?: string | null; modality?: string | null }) => {
		const system = 'system' in filters ? filters.system : data.selected;
		const modality = 'modality' in filters ? filters.modality : data.modality;
		const parts = [
			system ? `system=${encodeURIComponent(system)}` : '',
			modality ? `modality=${modality}` : ''
		].filter(Boolean);
		return parts.length > 0 ? `?${parts.join('&')}` : '';
	};

	const modalities = [
		{ value: null, label: m.tables_filter_modality_all },
		{ value: 'online', label: m.table_modality_online },
		{ value: 'in_person', label: m.table_modality_in_person }
	] as const;

	const more = $derived(
		data.systems.filter((system) => !data.featured.some((f) => f.slug === system.slug))
	);

	const count = $derived(
		data.tables.length === 1 ? m.tables_count_one() : m.tables_count({ count: data.tables.length })
	);

	const chip =
		'inline-flex h-11 shrink-0 items-center rounded-full border-[1.5px] px-[18px] text-[15px] font-semibold whitespace-nowrap no-underline';
	const chipIdle = `${chip} border-surface-200-800 bg-panel hover:preset-tonal`;
	const chipActive = `${chip} border-primary-500 preset-filled-primary-500`;
</script>

<svelte:head>
	<title>{m.tables_title()}</title>
	<meta name="description" content={m.tables_description()} />
</svelte:head>

<section class="pt-2 pb-2 md:pt-12">
	<div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
		<div>
			<h1
				class="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[68px]"
			>
				{m.tables_title()}
			</h1>
			<p class="mt-2.5 max-w-[46ch] text-[17px] text-muted md:mt-3.5 md:text-xl">
				{m.tables_lede()}
			</p>
		</div>
		<!-- On a phone the tab bar offers this once the platform is released; until then, the page does. -->
		<a
			href={localizedHref('/tables/new', locale)}
			class="btn h-[52px] shrink-0 gap-2.5 rounded-lg preset-filled-primary-500 px-6 font-semibold md:inline-flex {data.released
				? 'hidden'
				: 'inline-flex'}"
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
				class="shrink-0"><path d="M12 5v14M5 12h14" /></svg
			>
			{m.tables_open_cta()}
		</a>
	</div>

	<!-- Plain links: the filter works without JavaScript, and the URL can be shared. -->
	<div
		role="group"
		aria-labelledby="system-filter"
		class="mt-5 md:mt-8 md:flex md:items-start md:gap-5"
	>
		<span
			id="system-filter"
			class="block pb-2 text-sm font-semibold text-muted md:w-[88px] md:shrink-0 md:pb-0 md:text-[15px] md:leading-[44px]"
		>
			{m.tables_filter_label()}
		</span>
		<div class="md:flex md:flex-wrap md:gap-2.5">
			<div class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:contents">
				<a
					href={localizedHref(`/tables${query({ system: null })}`, locale)}
					aria-current={data.selected ? undefined : 'page'}
					class={data.selected ? chipIdle : chipActive}>{m.tables_filter_all()}</a
				>
				{#each data.featured as system (system.slug)}
					<a
						href={localizedHref(`/tables${query({ system: system.slug })}`, locale)}
						aria-current={system.slug === data.selected ? 'page' : undefined}
						class={system.slug === data.selected ? chipActive : chipIdle}>{system.name}</a
					>
				{/each}
			</div>
			{#if more.length > 0}
				<details class="group relative mt-2 md:mt-0">
					<summary
						class="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-full border-[1.5px] border-dashed border-surface-600-400 pr-3.5 pl-4 text-[15px] font-semibold whitespace-nowrap hover:preset-tonal [&::-webkit-details-marker]:hidden"
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
							<circle cx="11" cy="11" r="6.5" />
							<path d="M20 20l-4.2-4.2" />
						</svg>
						{m.tables_filter_more()}
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							class="shrink-0 transition-transform group-open:rotate-180"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</summary>
					<ul
						class="mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-surface-200-800 bg-panel p-1.5 shadow-xl md:absolute md:z-20 md:w-72"
					>
						{#each more as system (system.slug)}
							<li>
								<a
									href={localizedHref(`/tables${query({ system: system.slug })}`, locale)}
									class="flex min-h-11 items-center rounded-lg px-3 font-semibold no-underline hover:preset-tonal"
									>{system.name}</a
								>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>
	</div>

	<div role="group" aria-labelledby="modality-filter" class="mt-4 md:flex md:items-start md:gap-5">
		<span
			id="modality-filter"
			class="block pb-2 text-sm font-semibold text-muted md:w-[88px] md:shrink-0 md:pb-0 md:text-[15px] md:leading-[44px]"
		>
			{m.tables_filter_modality()}
		</span>
		<div class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:gap-2.5 md:px-0">
			{#each modalities as option (option.value)}
				<a
					href={localizedHref(`/tables${query({ modality: option.value })}`, locale)}
					aria-current={option.value === data.modality ? 'page' : undefined}
					class={option.value === data.modality ? chipActive : chipIdle}>{option.label()}</a
				>
			{/each}
		</div>
	</div>

	{#if data.tables.length > 0}
		<p role="status" class="mt-8 hidden text-[15px] font-semibold text-muted md:block">
			{count}
		</p>
		<ul class="mt-5 grid gap-4 md:mt-3.5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
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
