<script lang="ts">
	import { resolve } from '$app/paths';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { formatDuration, formatSession } from '$lib/tables/format';
	import type { FormMessage } from '$lib/forms/message';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { ratingSchema } from '$lib/tables/rating';
	import { registrationError } from '$lib/tables/registration-errors';
	import { toast } from '$lib/toaster';
	import ActionForm from '$lib/components/ActionForm.svelte';

	let { data, form } = $props();

	// What the last seat action answered: from a submit with JavaScript (`onfail`), or from the page the server sent back without it.
	let failed = $state<FormMessage | null>(null);
	const problem = $derived(failed ?? form?.form?.message ?? null);

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
	// svelte-ignore state_referenced_locally
	const rating = superForm(data.ratingForm, {
		validators: zod4Client(ratingSchema),
		resetForm: false,
		onResult({ result }) {
			if (result.type === 'redirect') toast.success(m.toast_rating_saved());
		},
		onUpdated({ form: updated }) {
			if (updated.valid || !updated.message) return;
			toast.error(registrationError(updated.message.code, updated.message.retryAfter));
			failed = updated.message;
		}
	});
	const { form: ratingValues, errors: ratingErrors, enhance: ratingEnhance } = rating;
	const scoreFields = $derived([
		{ name: 'tableScore', label: m.rating_the_table() },
		{ name: 'gmScore', label: m.rating_the_gm() }
	] as const);
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
	<a href={localizedHref('/tables', locale)} class="anchor">{m.table_back()}</a>

	<p class="mt-8 flex flex-wrap items-center gap-2 text-sm">
		<span class="chip preset-filled-primary-500">
			{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
		</span>
		<span class="font-semibold text-warning-700-300">{seats}</span>
	</p>

	<h1 class="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">{table.title}</h1>

	{#if table.imageUrl}
		<img
			src={table.imageUrl}
			alt=""
			referrerpolicy="no-referrer"
			class="mt-6 max-h-80 w-full max-w-2xl rounded-container object-cover"
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
		<a href={localizedHref(`/tables/${table.slug}/edit`, locale)} class="mt-4 inline-block anchor">
			{m.table_edit()}
		</a>
	{/if}

	<dl class="mt-8 grid max-w-2xl gap-x-8 gap-y-4 sm:grid-cols-[max-content_1fr]">
		<dt class="font-semibold">{m.table_system()}</dt>
		<dd>
			<a
				href="{localizedHref('/tables', locale)}?system={encodeURIComponent(table.system.slug)}"
				class="anchor"
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

	{#if problem}
		<p role="alert" class="mt-4 max-w-[44ch] font-semibold text-error-700-300">
			{registrationError(problem.code, problem.retryAfter)}
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
				class="btn preset-filled-primary-500"
			>
				{m.table_sign_in_to_join()}
			</a>
		{:else if data.myStatus === 'confirmed'}
			<p class="font-semibold">{m.table_you_are_in()}</p>
			<ActionForm action="?/leave" class="mt-3" onfail={(message) => (failed = message)}>
				<button type="submit" class="btn preset-outlined-primary-500">
					{m.table_leave()}
				</button>
			</ActionForm>
		{:else if data.myStatus === 'pending'}
			<p class="font-semibold">{m.table_request_pending()}</p>
			<ActionForm action="?/leave" class="mt-3" onfail={(message) => (failed = message)}>
				<button type="submit" class="btn preset-outlined-primary-500">
					{m.table_cancel_request()}
				</button>
			</ActionForm>
		{:else if data.canJoin}
			<ActionForm
				action="?/join"
				onfail={(message) => (failed = message)}
				onsuccess={() =>
					table.joinMode === 'approval'
						? toast.pending(m.toast_pending())
						: toast.success(m.toast_confirmed())}
			>
				<button type="submit" class="btn preset-filled-primary-500">
					{table.joinMode === 'approval' ? m.table_join_request() : m.table_join_now()}
				</button>
			</ActionForm>
		{/if}
	</div>

	<!-- Only someone who played (a confirmed seat, and the first session is over) can rate. -->
	{#if data.canRate}
		<section id="avaliar" class="mt-12 max-w-2xl">
			<h2 class="text-2xl font-semibold">{m.rating_title()}</h2>
			<p class="mt-2 max-w-[55ch]">{m.rating_lede()}</p>
			{#if data.myRating}<p role="status" class="mt-2 font-semibold">{m.rating_saved()}</p>{/if}

			<form method="POST" action="?/rate" use:ratingEnhance class="mt-4 grid gap-6">
				{#each scoreFields as { name, label } (name)}
					<fieldset>
						<legend class="font-semibold">{label}</legend>
						<div class="mt-2 flex flex-wrap gap-3">
							{#each [1, 2, 3, 4, 5] as score (score)}
								<label class="flex items-center gap-1">
									<input
										type="radio"
										{name}
										value={score}
										required
										bind:group={$ratingValues[name]}
									/>
									<span aria-label={m.rating_score_label({ score })}>{score}</span>
								</label>
							{/each}
						</div>
						{#if $ratingErrors[name]}
							<p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
								{m.table_error_invalid()}
							</p>
						{/if}
					</fieldset>
				{/each}

				<div>
					<label for="comment" class="label-text block font-semibold">{m.rating_comment()}</label>
					<textarea
						id="comment"
						name="comment"
						rows="3"
						maxlength="1000"
						bind:value={$ratingValues.comment}
						class="mt-1 textarea"></textarea>
				</div>

				<div>
					<button type="submit" class="btn preset-filled-primary-500">
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
							class="flex items-center justify-between gap-4 card border border-surface-200-800 bg-surface-100-900 p-3"
						>
							<span>{player.displayName}</span>
							<ActionForm
								action="?/remove"
								playerId={player.playerId}
								onfail={(message) => (failed = message)}
							>
								<button type="submit" class="btn preset-tonal-error btn-sm"
									>{m.table_remove()}</button
								>
							</ActionForm>
						</li>
					{/each}
				</ul>
			{/if}

			{#if requests.length > 0}
				<h2 class="mt-8 text-2xl font-semibold">{m.table_requests()}</h2>
				<ul class="mt-3 grid gap-2">
					{#each requests as request (request.playerId)}
						<li
							class="flex items-center justify-between gap-4 card border border-surface-200-800 bg-surface-100-900 p-3"
						>
							<span>{request.displayName}</span>
							<span class="flex gap-4">
								<ActionForm
									action="?/approve"
									playerId={request.playerId}
									onfail={(message) => (failed = message)}
								>
									<button type="submit" class="btn preset-tonal-primary btn-sm"
										>{m.table_approve()}</button
									>
								</ActionForm>
								<ActionForm
									action="?/decline"
									playerId={request.playerId}
									onfail={(message) => (failed = message)}
								>
									<button type="submit" class="btn preset-tonal-error btn-sm"
										>{m.table_decline()}</button
									>
								</ActionForm>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</article>
