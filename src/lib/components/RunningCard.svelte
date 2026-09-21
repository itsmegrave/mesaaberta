<script lang="ts">
	import { formatSession } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import ActionForm from './ActionForm.svelte';

	type Person = { playerId: string; displayName: string };
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
</script>

<article class="card border border-surface-200-800 bg-surface-100-900 p-4">
	<p class="flex flex-wrap items-center gap-2 text-sm">
		{#if item.tableStatus === 'disabled'}<span class="font-semibold">{m.dash_disabled()}</span>{/if}
		<span>{m.dash_seats_taken({ taken: item.players.length, capacity: item.capacity })}</span>
	</p>

	<h3 class="mt-2 text-xl font-semibold"><a href={page} class="anchor">{item.title}</a></h3>

	<p class="mt-2">
		{#if item.nextAt}
			<span class="font-semibold">{m.table_next_session()}:</span>
			{formatSession(item.nextAt, item.timezone, locale)}
		{:else}
			{m.table_no_more_sessions()}
		{/if}
	</p>

	<p class="mt-2">
		<a href={localizedHref(`/tables/${item.slug}/edit`, locale)} class="anchor">{m.dash_edit()}</a>
	</p>

	{#if item.requests.length > 0}
		<h4 class="mt-5 font-semibold">{m.dash_requests()} ({item.requests.length})</h4>
		<ul class="mt-2 grid gap-2">
			{#each item.requests as request (request.playerId)}
				<li
					class="flex flex-wrap items-center justify-between gap-3 rounded bg-surface-200-800 p-2"
				>
					<span>{request.displayName}</span>
					<span class="flex gap-4">
						{#each [['approve', m.table_approve(), 'preset-tonal-primary'], ['decline', m.table_decline(), 'preset-tonal-error']] as [action, label, tone] (action)}
							<ActionForm action="{page}?/{action}" playerId={request.playerId} {next}>
								<button type="submit" class="btn btn-sm {tone}">{label}</button>
							</ActionForm>
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
				<li class="flex items-center justify-between gap-3 rounded bg-surface-200-800 p-2">
					<span>{player.displayName}</span>
					<ActionForm action="{page}?/remove" playerId={player.playerId} {next}>
						<button type="submit" class="btn preset-tonal-error btn-sm">{m.table_remove()}</button>
					</ActionForm>
				</li>
			{/each}
		</ul>
	{/if}
</article>
