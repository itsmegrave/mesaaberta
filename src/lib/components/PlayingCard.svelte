<script lang="ts">
	import { formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	type Item = {
		slug: string;
		title: string;
		systemName: string;
		gmName: string;
		status: 'pending' | 'confirmed';
		tableStatus: 'active' | 'disabled';
		timezone: string;
		nextAt: Date | null;
		canRate: boolean;
		rating: { tableScore: number; gmScore: number } | null;
	};

	let { item, next }: { item: Item; next: string } = $props();

	const locale = getLocale();
	const page = $derived(localizedHref(`/tables/${item.slug}`, locale));
</script>

<article class="rounded border border-petrol/15 bg-white p-4">
	<p class="flex flex-wrap items-center gap-2 text-sm">
		{#if item.status === 'pending'}
			<span class="rounded-full bg-lamp px-2 py-0.5 font-semibold text-white"
				>{m.dash_waiting()}</span
			>
		{:else}
			<span class="rounded-full bg-petrol px-2 py-0.5 font-semibold text-celadon">
				{m.dash_you_have_seat()}
			</span>
		{/if}
		{#if item.tableStatus === 'disabled'}<span class="font-semibold">{m.dash_disabled()}</span>{/if}
		<span>{item.systemName}</span>
	</p>

	<h3 class="mt-2 text-xl font-semibold">
		<a href={page} class="text-link">{item.title}</a>
	</h3>
	<p class="mt-1 text-sm">{m.table_gm()}: {item.gmName}</p>

	{#if item.nextAt}
		<p class="mt-3">
			<span class="font-semibold">{m.table_next_session()}:</span>
			{formatSession(item.nextAt, item.timezone, locale)}
		</p>
	{/if}

	{#if item.canRate}
		<p class="mt-3">
			{#if item.rating}
				{m.dash_your_rating({ table: item.rating.tableScore, gm: item.rating.gmScore })}
				<a href="{page}#avaliar" class="text-link">{m.dash_change_rating()}</a>
			{:else}
				{m.dash_rate_prompt()}
				<a href="{page}#avaliar" class="text-link font-semibold">{m.dash_rate_action()}</a>
			{/if}
		</p>
	{/if}

	<!-- Leaving, or withdrawing a request, posts to the table's own action and comes back here. -->
	<form method="POST" action="{page}?/leave" class="mt-4">
		<input type="hidden" name="next" value={next} />
		<button type="submit" class="rounded border border-petrol px-4 py-2 font-semibold">
			{item.status === 'pending' ? m.table_cancel_request() : m.table_leave()}
		</button>
	</form>
</article>
