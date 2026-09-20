<script lang="ts">
	import { formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	type Table = {
		slug: string;
		title: string;
		kind: 'campaign' | 'one_shot';
		system: { name: string };
		gmName: string;
		seatsLeft: number;
		timezone: string;
		nextAt: Date | null;
		imageUrl?: string | null;
	};

	let { table }: { table: Table } = $props();

	const locale = getLocale();
	const seats = $derived(
		table.seatsLeft === 0
			? m.table_full()
			: table.seatsLeft === 1
				? m.table_seat_left()
				: m.table_seats_left({ count: table.seatsLeft })
	);
</script>

<article
	class="relative rounded border border-petrol/15 bg-white p-4 focus-within:ring-2 focus-within:ring-lamp"
>
	{#if table.imageUrl}
		<img
			src={table.imageUrl}
			alt=""
			loading="lazy"
			referrerpolicy="no-referrer"
			class="-mx-4 -mt-4 mb-3 h-36 w-[calc(100%+2rem)] rounded-t object-cover"
		/>
	{/if}
	<p class="flex flex-wrap items-center gap-2 text-sm">
		<span class="rounded-full bg-petrol px-2 py-0.5 font-semibold text-celadon">
			{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
		</span>
		<span>{table.system.name}</span>
	</p>

	<h2 class="mt-2 text-xl font-semibold">
		<!-- The whole card is the link: the ::after fills it, so the tap target is large on a phone. -->
		<a
			href={localizedHref(`/tables/${table.slug}`, locale)}
			class="after:absolute after:inset-0 after:content-['']"
		>
			{table.title}
		</a>
	</h2>

	<p class="mt-1 text-sm">{m.table_gm()}: {table.gmName}</p>

	<p class="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		{#if table.nextAt}
			<span>{formatSession(table.nextAt, table.timezone, locale)}</span>
		{/if}
		<span class="font-semibold {table.seatsLeft === 0 ? '' : 'text-lamp'}">{seats}</span>
	</p>
</article>
