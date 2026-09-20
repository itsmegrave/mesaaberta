<script lang="ts">
	import { formatDuration, formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	const table = $derived(data.table);
	const locale = getLocale();

	const recurrence = $derived(
		table.kind === 'one_shot'
			? m.table_recurrence_once()
			: table.everyWeeks === 1
				? m.table_recurrence_weekly()
				: table.everyWeeks
					? m.table_recurrence_weeks({ weeks: table.everyWeeks })
					: null
	);
	const seats = $derived(
		table.seatsLeft === 0
			? m.table_full()
			: table.seatsLeft === 1
				? m.table_seat_left()
				: m.table_seats_left({ count: table.seatsLeft })
	);
</script>

<svelte:head>
	<title>{table.title}</title>
	<meta name="description" content="{table.system.name}. {seats}." />
</svelte:head>

<article class="py-10 md:py-16">
	<a href={localizedHref('/tables', locale)} class="text-link">{m.table_back()}</a>

	<p class="mt-8 flex flex-wrap items-center gap-2 text-sm">
		<span class="rounded-full bg-petrol px-2 py-0.5 font-semibold text-celadon">
			{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
		</span>
		<span class="font-semibold text-lamp">{seats}</span>
	</p>

	<h1 class="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">{table.title}</h1>

	<dl class="mt-8 grid max-w-2xl gap-x-8 gap-y-4 sm:grid-cols-[max-content_1fr]">
		<dt class="font-semibold">{m.table_system()}</dt>
		<dd>
			<a
				href="{localizedHref('/tables', locale)}?system={encodeURIComponent(table.system.slug)}"
				class="text-link"
			>
				{table.system.name}
			</a>
		</dd>

		<dt class="font-semibold">{m.table_gm()}</dt>
		<dd>{table.gmName}</dd>

		<dt class="font-semibold">{m.table_next_session()}</dt>
		<dd>
			{#if table.nextAt}
				{formatSession(table.nextAt, table.timezone, locale)}
			{:else}
				{m.table_no_more_sessions()}
			{/if}
		</dd>

		<dt class="font-semibold">{m.table_schedule()}</dt>
		<dd>{recurrence}</dd>

		<dt class="font-semibold">{m.table_duration()}</dt>
		<dd>{formatDuration(table.durationMinutes)}</dd>
	</dl>

	<!-- User text is rendered as text and never as markup; line breaks are kept by the CSS. -->
	{#if table.description}
		<p class="mt-8 max-w-[65ch] whitespace-pre-line">{table.description}</p>
	{/if}

	{#if table.extraInfo}
		<h2 class="mt-8 text-2xl font-semibold">{m.table_extra_info()}</h2>
		<p class="mt-2 max-w-[65ch] whitespace-pre-line">{table.extraInfo}</p>
	{/if}

	<p class="mt-8">
		{table.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}
	</p>
</article>
