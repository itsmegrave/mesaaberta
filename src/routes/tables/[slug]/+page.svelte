<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDuration, formatSession, formatWait } from '$lib/tables/format';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data, form } = $props();

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
	const number = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
	const votes = (count: number) => (count === 1 ? m.rating_count_one() : m.rating_count({ count }));
	const scoreFields = $derived([
		{ name: 'tableScore', label: m.rating_the_table(), current: data.myRating?.tableScore },
		{ name: 'gmScore', label: m.rating_the_gm(), current: data.myRating?.gmScore }
	]);
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
		<span class="rounded-full bg-petrol px-2 py-0.5 font-semibold text-on-petrol">
			{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
		</span>
		<span class="font-semibold text-lamp">{seats}</span>
	</p>

	<h1 class="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">{table.title}</h1>

	{#if table.imageUrl}
		<img
			src={table.imageUrl}
			alt=""
			referrerpolicy="no-referrer"
			class="mt-6 max-h-80 w-full max-w-2xl rounded object-cover"
		/>
	{/if}

	{#if data.ratings.table.count > 0 || data.ratings.gm.count > 0}
		<p class="mt-4 flex flex-wrap gap-x-6 gap-y-1">
			{#if data.ratings.table.count > 0}
				<span>
					{m.rating_table_average()}:
					<strong>{number.format(data.ratings.table.average ?? 0)}</strong>
					({votes(data.ratings.table.count)})
				</span>
			{/if}
			{#if data.ratings.gm.count > 0}
				<span>
					{m.rating_gm_average()}:
					<strong>{number.format(data.ratings.gm.average ?? 0)}</strong>
					({votes(data.ratings.gm.count)})
				</span>
			{/if}
		</p>
	{/if}

	{#if data.canEdit}
		<a
			href={localizedHref(`/tables/${table.slug}/edit`, locale)}
			class="mt-4 inline-block text-link"
		>
			{m.table_edit()}
		</a>
	{/if}

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

	{#if form?.error}
		<p role="alert" class="mt-4 max-w-[44ch] font-semibold text-danger">
			{form.error === 'rate_limited'
				? m.error_rate_limited({ wait: formatWait(form.retryAfter ?? 60) })
				: form.error === 'table_full'
					? m.table_error_full()
					: form.error === 'already_registered'
						? m.table_error_already()
						: form.error === 'forbidden'
							? m.table_error_forbidden()
							: form.error === 'too_early'
								? m.table_error_too_early()
								: form.error === 'invalid'
									? m.table_error_invalid()
									: m.table_error_other()}
		</p>
	{/if}

	<!-- What this visitor can do about a seat. The server checks it again on every action. -->
	<div class="mt-6">
		{#if data.isGm}
			<p class="font-semibold">{m.table_you_are_gm()}</p>
		{:else if !data.signedIn}
			<a
				href="{resolve('/login')}?next={encodeURIComponent(
					localizedHref(`/tables/${table.slug}`, locale)
				)}"
				class="inline-block rounded bg-petrol px-5 py-3 font-semibold text-on-petrol"
			>
				{m.table_sign_in_to_join()}
			</a>
		{:else if data.myStatus === 'confirmed'}
			<p class="font-semibold">{m.table_you_are_in()}</p>
			<form method="POST" action="?/leave" class="mt-3">
				<button type="submit" class="rounded border border-petrol px-5 py-3 font-semibold">
					{m.table_leave()}
				</button>
			</form>
		{:else if data.myStatus === 'pending'}
			<p class="font-semibold">{m.table_request_pending()}</p>
			<form method="POST" action="?/leave" class="mt-3">
				<button type="submit" class="rounded border border-petrol px-5 py-3 font-semibold">
					{m.table_cancel_request()}
				</button>
			</form>
		{:else if data.canJoin}
			<form method="POST" action="?/join">
				<button type="submit" class="rounded bg-petrol px-5 py-3 font-semibold text-on-petrol">
					{table.joinMode === 'approval' ? m.table_join_request() : m.table_join_now()}
				</button>
			</form>
		{/if}
	</div>

	<!-- Only someone who played (a confirmed seat, and the first session is over) can rate. -->
	{#if data.canRate}
		<section id="avaliar" class="mt-12 max-w-2xl">
			<h2 class="text-2xl font-semibold">{m.rating_title()}</h2>
			<p class="mt-2 max-w-[55ch]">{m.rating_lede()}</p>
			{#if data.myRating}<p role="status" class="mt-2 font-semibold">{m.rating_saved()}</p>{/if}

			<form method="POST" action="?/rate" class="mt-4 grid gap-6">
				{#each scoreFields as { name, label, current } (name)}
					<fieldset>
						<legend class="font-semibold">{label}</legend>
						<div class="mt-2 flex flex-wrap gap-3">
							{#each [1, 2, 3, 4, 5] as score (score)}
								<label class="flex items-center gap-1">
									<input type="radio" {name} value={score} required checked={current === score} />
									<span aria-label={m.rating_score_label({ score })}>{score}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/each}

				<div>
					<label for="comment" class="block font-semibold">{m.rating_comment()}</label>
					<textarea
						id="comment"
						name="comment"
						rows="3"
						maxlength="1000"
						class="mt-1 block w-full rounded border border-ink/60 bg-surface px-3 py-2"
						>{data.myRating?.comment ?? ''}</textarea
					>
				</div>

				<div>
					<button type="submit" class="rounded bg-petrol px-5 py-3 font-semibold text-on-petrol">
						{data.myRating ? m.rating_update() : m.rating_submit()}
					</button>
				</div>
			</form>
		</section>
	{/if}

	<!-- The GM's (and admins') view: who has a seat and who is asking. Names are not public. -->
	{#if data.registrations}
		{@const players = data.registrations.filter((r) => r.status === 'confirmed')}
		{@const requests = data.registrations.filter((r) => r.status === 'pending')}

		<section class="mt-12 max-w-2xl">
			<h2 class="text-2xl font-semibold">{m.table_players()}</h2>
			{#if players.length === 0}
				<p class="mt-2">{m.table_no_players()}</p>
			{:else}
				<ul class="mt-3 grid gap-2">
					{#each players as player (player.playerId)}
						<li
							class="flex items-center justify-between gap-4 rounded border border-petrol/15 bg-surface p-3"
						>
							<span>{player.username}</span>
							<form method="POST" action="?/remove">
								<input type="hidden" name="playerId" value={player.playerId} />
								<button type="submit" class="font-semibold text-danger">{m.table_remove()}</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}

			{#if requests.length > 0}
				<h2 class="mt-8 text-2xl font-semibold">{m.table_requests()}</h2>
				<ul class="mt-3 grid gap-2">
					{#each requests as request (request.playerId)}
						<li
							class="flex items-center justify-between gap-4 rounded border border-petrol/15 bg-surface p-3"
						>
							<span>{request.username}</span>
							<span class="flex gap-4">
								<form method="POST" action="?/approve">
									<input type="hidden" name="playerId" value={request.playerId} />
									<button type="submit" class="font-semibold">{m.table_approve()}</button>
								</form>
								<form method="POST" action="?/decline">
									<input type="hidden" name="playerId" value={request.playerId} />
									<button type="submit" class="font-semibold text-danger"
										>{m.table_decline()}</button
									>
								</form>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</article>
