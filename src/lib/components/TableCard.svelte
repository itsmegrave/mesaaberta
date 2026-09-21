<script lang="ts">
	import { formatCardDate, formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import SeatRing from './SeatRing.svelte';

	type PlatformItem = string | { name: string; slug?: string };
	type TagItem = string | { name: string; slug?: string };

	type Table = {
		slug: string;
		title: string;
		kind: 'campaign' | 'one_shot';
		system: { name: string };
		gmName: string;
		seatsLeft: number;
		capacity?: number;
		timezone: string;
		nextAt: Date | null;
		imageUrl?: string | null;
		platforms?: PlatformItem[];
		tags?: TagItem[];
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

	const cardDate = $derived(
		table.nextAt ? formatCardDate(table.nextAt, table.timezone, locale) : null
	);

	const platformNames = $derived(
		(table.platforms ?? []).map((p) => (typeof p === 'string' ? p : p.name)).filter(Boolean)
	);
	const firstPlatform = $derived(platformNames[0] ?? null);
	const morePlatformsCount = $derived(Math.max(0, platformNames.length - 1));

	const tagNames = $derived(
		(table.tags ?? []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean)
	);
	const firstTag = $derived(tagNames[0] ?? null);
	const moreTagsCount = $derived(Math.max(0, tagNames.length - 1));
</script>

<article
	class="group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface transition-shadow focus-within:ring-2 focus-within:ring-lamp hover:shadow-md"
>
	<!-- Top header tile: With cover image vs solid petrol tile without cover -->
	{#if table.imageUrl}
		<div class="relative h-[148px] shrink-0 overflow-hidden bg-petrol">
			<img
				src={table.imageUrl}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				class="absolute inset-0 h-full w-full object-cover"
			/>
			<!-- Kind pill -->
			<div class="absolute top-3.5 left-3.5">
				<span
					class="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-petrol bg-petrol px-3 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-on-petrol shadow-sm"
				>
					{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
				</span>
			</div>
			<!-- Date chip -->
			{#if table.nextAt && cardDate}
				<div
					class="absolute bottom-3.5 left-3.5 rounded-xl bg-petrol px-3 pt-2 pb-[9px] text-on-petrol shadow-sm"
				>
					<div class="font-sans text-[22px] leading-none font-bold tracking-tight">
						{cardDate.dayMonth}
					</div>
					<div class="mt-1 font-sans text-[13px] leading-tight font-medium opacity-90">
						{cardDate.weekdayTime}
					</div>
				</div>
			{/if}
			<!-- Seat ring chip -->
			<div class="absolute right-3.5 bottom-3.5 rounded-2xl bg-petrol p-1.5 shadow-sm">
				<SeatRing capacity={table.capacity ?? 5} seatsLeft={table.seatsLeft} size={64} />
			</div>
		</div>
	{:else}
		<div
			class="flex h-[148px] shrink-0 items-stretch justify-between gap-3 bg-petrol p-[18px_20px] text-on-petrol"
		>
			<div class="flex min-w-0 flex-col items-start justify-between">
				<span
					class="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-transparent bg-white/15 px-3 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-on-petrol"
				>
					{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
				</span>
				{#if table.nextAt && cardDate}
					<div>
						<div class="font-sans text-4xl leading-none font-bold tracking-tight">
							{cardDate.dayMonth}
						</div>
						<div class="mt-1.5 font-sans text-sm leading-snug font-medium opacity-90">
							{cardDate.weekdayTime}
						</div>
					</div>
				{/if}
			</div>
			<div class="flex items-center">
				<SeatRing capacity={table.capacity ?? 5} seatsLeft={table.seatsLeft} size={112} />
			</div>
		</div>
	{/if}

	<!-- Full accessible date for screen readers -->
	{#if table.nextAt}
		<time datetime={table.nextAt.toISOString()} class="sr-only">
			{formatSession(table.nextAt, table.timezone, locale)}
		</time>
	{/if}

	<!-- Card body -->
	<div class="flex grow flex-col p-[20px_22px_18px]">
		<div class="font-sans text-sm leading-snug font-semibold text-ink/75">
			{table.system.name}
		</div>

		<h3 class="mt-1 font-sans text-[26px] leading-[1.15] font-semibold tracking-tight text-ink">
			<a
				href={localizedHref(`/tables/${table.slug}`, locale)}
				class="after:absolute after:inset-0 after:content-[''] hover:underline"
			>
				{table.title}
			</a>
		</h3>

		<div class="mt-2 font-serif text-[15px] leading-normal text-ink/75">
			{m.table_gm()}: {table.gmName}
		</div>

		<!-- Chips line: first platform ("Discord +1") and first tag with "+N", never a second line -->
		{#if firstPlatform || firstTag}
			<div class="mt-3 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
				{#if firstPlatform}
					<span
						class="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-ink"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="shrink-0"
							aria-hidden="true"
						>
							<rect x="3" y="4.5" width="18" height="12" rx="2.5"></rect>
							<path d="M8.5 20h7M12 16.5V20"></path>
						</svg>
						{firstPlatform}{morePlatformsCount > 0 ? ` +${morePlatformsCount}` : ''}
					</span>
				{/if}
				{#if firstTag}
					<span
						class="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-wash px-2.5 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-ink"
					>
						{firstTag}
					</span>
				{/if}
				{#if moreTagsCount > 0}
					<span
						class="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-wash px-2.5 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-ink"
					>
						+{moreTagsCount}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Footer -->
		<div class="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3.5">
			<span
				class="font-sans text-base font-semibold {table.seatsLeft === 0
					? 'text-ink/60'
					: 'text-lamp'}"
			>
				{seats}
			</span>
			<span
				aria-hidden="true"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wash text-ink transition-transform group-hover:translate-x-1"
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
					class="shrink-0"
				>
					<path d="M5 12h14M13 6l6 6-6 6"></path>
				</svg>
			</span>
		</div>
	</div>
</article>
