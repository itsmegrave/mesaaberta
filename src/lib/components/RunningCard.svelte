<script lang="ts">
	import { formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	type Person = { playerId: string; username: string };
	type Item = {
		slug: string;
		title: string;
		tableStatus: 'active' | 'disabled';
		capacity: number;
		timezone: string;
		nextAt: Date | null;
		players: Person[];
		requests: Person[];
	};

	let { item, next }: { item: Item; next: string } = $props();

	const locale = getLocale();
	const page = $derived(localizedHref(`/tables/${item.slug}`, locale));
	const button = 'font-semibold';
</script>

<article class="rounded border border-petrol/15 bg-surface p-4">
	<p class="flex flex-wrap items-center gap-2 text-sm">
		{#if item.tableStatus === 'disabled'}<span class="font-semibold">{m.dash_disabled()}</span>{/if}
		<span>{m.dash_seats_taken({ taken: item.players.length, capacity: item.capacity })}</span>
	</p>

	<h3 class="mt-2 text-xl font-semibold"><a href={page} class="text-link">{item.title}</a></h3>

	<p class="mt-2">
		{#if item.nextAt}
			<span class="font-semibold">{m.table_next_session()}:</span>
			{formatSession(item.nextAt, item.timezone, locale)}
		{:else}
			{m.table_no_more_sessions()}
		{/if}
	</p>

	<p class="mt-2">
		<a href={localizedHref(`/tables/${item.slug}/edit`, locale)} class="text-link"
			>{m.dash_edit()}</a
		>
	</p>

	{#if item.requests.length > 0}
		<h4 class="mt-5 font-semibold">{m.dash_requests()} ({item.requests.length})</h4>
		<ul class="mt-2 grid gap-2">
			{#each item.requests as request (request.playerId)}
				<li class="flex flex-wrap items-center justify-between gap-3 rounded bg-celadon/60 p-2">
					<span>{request.username}</span>
					<span class="flex gap-4">
						{#each [['approve', m.table_approve(), ''], ['decline', m.table_decline(), 'text-danger']] as [action, label, tone] (action)}
							<form method="POST" action="{page}?/{action}">
								<input type="hidden" name="playerId" value={request.playerId} />
								<input type="hidden" name="next" value={next} />
								<button type="submit" class="{button} {tone}">{label}</button>
							</form>
						{/each}
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<h4 class="mt-5 font-semibold">{m.dash_players()}</h4>
	{#if item.players.length === 0}
		<p class="mt-1">{m.dash_none_yet()}</p>
	{:else}
		<ul class="mt-2 grid gap-2">
			{#each item.players as player (player.playerId)}
				<li class="flex items-center justify-between gap-3 rounded bg-celadon/60 p-2">
					<span>{player.username}</span>
					<form method="POST" action="{page}?/remove">
						<input type="hidden" name="playerId" value={player.playerId} />
						<input type="hidden" name="next" value={next} />
						<button type="submit" class="{button} text-danger">{m.table_remove()}</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</article>
