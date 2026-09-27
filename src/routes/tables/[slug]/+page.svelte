<script lang="ts">
	import { atHandle } from '$lib/profile/handle';
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
	const seatColours = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];

	// The calendar tile next to the session: "SÁB / 26 / SET", in the table's timezone.
	const dateBox = $derived.by(() => {
		if (!table.nextAt) return null;
		const part = (options: Intl.DateTimeFormatOptions) =>
			new Intl.DateTimeFormat(locale, { timeZone: table.timezone, ...options })
				.format(table.nextAt!)
				.replace('.', '');
		return {
			weekday: part({ weekday: 'short' }),
			day: part({ day: 'numeric' }),
			month: part({ month: 'short' })
		};
	});

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

<article class="pt-2 pb-8 md:pt-6">
	<a
		href={localizedHref('/tables', locale)}
		class="inline-flex items-center gap-2 link-underline font-semibold decoration-primary-500"
	>
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
			class="shrink-0"><path d="M19 12H5M11 6l-6 6 6 6" /></svg
		>
		{m.table_back()}
	</a>

	<div class="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
		<div class="min-w-0">
			<p class="flex flex-wrap items-center gap-3">
				<span
					class="chip h-[26px] rounded-full preset-filled-primary-500 px-3 text-[13px] font-semibold"
				>
					{table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
				</span>
				<a
					href="{localizedHref('/tables', locale)}?system={encodeURIComponent(table.system.slug)}"
					class="font-semibold text-link underline decoration-2 underline-offset-4"
				>
					{table.system.name}
				</a>
			</p>

			<h1
				class="mt-3 text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[64px]"
			>
				{table.title}
			</h1>

			{#if table.tags.length > 0}
				<ul aria-label={m.form_tags()} class="mt-4 flex flex-wrap gap-2">
					{#each table.tags as tag (tag.slug)}
						<li>
							<a
								href="{localizedHref('/tables', locale)}?tag={encodeURIComponent(tag.slug)}"
								class="chip h-8 rounded-lg bg-surface-950/7 px-3 text-sm font-semibold hover:preset-tonal dark:bg-surface-50/8"
								>{tag.name}</a
							>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-5 flex flex-wrap items-center gap-4">
				<p>
					<span class="block text-sm font-semibold text-muted">{m.table_gm()}</span>
					<span class="text-lg font-semibold">{atHandle(table.gmName)}</span>
				</p>
				{#if data.ratings.gm.count > 0}
					<p
						class="inline-flex h-11 items-center gap-2 rounded-lg border border-surface-200-800 px-3.5"
					>
						<span class="sr-only"
							>{m.rating_gm_average()}: {number.format(data.ratings.gm.average ?? 0)} ({votes(
								data.ratings.gm.count
							)})</span
						>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="fill-lamp"
							><path
								d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z"
							/></svg
						>
						<strong aria-hidden="true" class="text-lg"
							>{number.format(data.ratings.gm.average ?? 0)}</strong
						>
						<span aria-hidden="true" class="text-sm text-muted"
							>({votes(data.ratings.gm.count)})</span
						>
					</p>
				{/if}
				{#if data.ratings.table.count > 0}
					<p class="text-sm text-muted">
						{m.rating_table_average()}:
						<strong>{number.format(data.ratings.table.average ?? 0)}</strong>
						({votes(data.ratings.table.count)})
					</p>
				{/if}
			</div>

			{#if data.canEdit}
				<a
					href={localizedHref(`/tables/${table.slug}/edit`, locale)}
					class="mt-4 inline-block link-underline font-semibold"
				>
					{m.table_edit()}
				</a>
			{/if}

			{#if table.imageUrl}
				<img
					src={table.imageUrl}
					alt=""
					referrerpolicy="no-referrer"
					class="mt-8 aspect-[736/300] w-full rounded-lg object-cover"
				/>
			{/if}

			<!-- User text is rendered as text and never as markup; line breaks are kept by the CSS. -->
			{#if table.description}
				<p class="mt-8 max-w-[65ch] text-lg whitespace-pre-line">{table.description}</p>
			{/if}

			{#if table.extraInfo}
				<h2 class="mt-10 text-[28px] font-semibold tracking-[-0.02em]">{m.table_extra_info()}</h2>
				<p class="mt-2 max-w-[65ch] whitespace-pre-line">{table.extraInfo}</p>
			{/if}

			{#if data.joinDetails}
				<section
					aria-labelledby="join-details"
					class="mt-8 max-w-[65ch] rounded-lg border border-surface-200-800 bg-panel p-5"
				>
					<h2 id="join-details" class="text-xl font-semibold">{m.table_join_details()}</h2>
					<p class="mt-2 break-words whitespace-pre-line">{data.joinDetails}</p>
					<p class="mt-3 text-sm text-muted">{m.table_join_details_private()}</p>
				</section>
			{/if}
		</div>

		<aside
			aria-label={m.table_next_session()}
			class="self-start rounded-lg border border-surface-200-800 bg-panel p-6 lg:p-7"
		>
			<div class="flex items-start gap-4">
				{#if dateBox}
					<div
						aria-hidden="true"
						class="flex w-[72px] shrink-0 flex-col items-center rounded-lg preset-filled-primary-500 py-2 leading-none"
					>
						<span class="text-xs font-bold tracking-wide uppercase">{dateBox.weekday}</span>
						<span class="mt-1 text-[28px] font-bold">{dateBox.day}</span>
						<span class="mt-1 text-xs font-bold tracking-wide uppercase">{dateBox.month}</span>
					</div>
				{/if}
				<div>
					<p class="text-sm font-semibold text-muted">{m.table_next_session()}</p>
					<p class="mt-1 text-xl leading-snug font-semibold">
						{#if table.nextAt}
							{formatSession(table.nextAt, table.timezone, locale)}
						{:else}
							{m.table_no_more_sessions()}
						{/if}
					</p>
				</div>
			</div>

			<dl class="mt-6 grid grid-cols-[max-content_1fr] border-t border-surface-200-800 text-[15px]">
				<dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
					{m.table_modality()}
				</dt>
				<dd class="border-b border-surface-200-800 py-3">
					{table.modality === 'in_person'
						? `${m.table_modality_in_person()} · ${table.locationArea}`
						: m.table_modality_online()}
				</dd>
				{#if table.platforms.length > 0}
					<dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
						{m.form_platforms()}
					</dt>
					<dd class="flex flex-wrap gap-1.5 border-b border-surface-200-800 py-3">
						{#each table.platforms as platform (platform.slug)}
							<span
								class="chip h-7 rounded-lg border border-surface-200-800 px-2.5 text-[13px] font-semibold"
								>{platform.name}</span
							>
						{/each}
					</dd>
				{/if}
				<dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
					{m.table_schedule()}
				</dt>
				<dd class="border-b border-surface-200-800 py-3">{recurrence}</dd>
				<dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
					{m.table_duration()}
				</dt>
				<dd class="border-b border-surface-200-800 py-3">
					{formatDuration(table.durationMinutes)}
				</dd>
			</dl>

			<div class="mt-5 flex items-baseline justify-between gap-3">
				<p class="text-xl font-semibold {table.seatsLeft === 0 ? 'text-muted' : 'text-lamp'}">
					{seats}
				</p>
				<p class="text-sm font-semibold text-muted">
					{m.table_seats_taken({ taken: table.capacity - table.seatsLeft, total: table.capacity })}
				</p>
			</div>
			<p aria-hidden="true" class="mt-3 flex flex-wrap gap-2">
				{#each { length: table.capacity }, i (i)}
					{#if i < table.capacity - table.seatsLeft}
						<span
							class="flex size-[34px] items-center justify-center rounded-full {seatColours[
								i % seatColours.length
							]}"><span class="size-3 rounded-full bg-surface-950/28"></span></span
						>
					{:else}
						<span
							class="block size-[34px] rounded-full border-2 border-dashed border-lamp bg-lamp-wash"
						></span>
					{/if}
				{/each}
			</p>

			{#if problem}
				<p role="alert" class="mt-5 font-semibold text-error-700-300">
					{registrationError(problem.code, problem.retryAfter)}
				</p>
			{/if}

			<!-- What this visitor can do about a seat. The server checks it again on every action. -->
			<div class="mt-5">
				{#if data.isGm}
					<p class="font-semibold">{m.table_you_are_gm()}</p>
				{:else if !data.signedIn}
					<a
						href="{resolve('/login')}?next={encodeURIComponent(
							localizedHref(`/tables/${table.slug}`, locale)
						)}"
						class="btn h-[52px] w-full rounded-lg preset-filled-primary-500 font-semibold"
					>
						{m.table_sign_in_to_join()}
					</a>
				{:else if data.myStatus === 'confirmed'}
					<p class="font-semibold">{m.table_you_are_in()}</p>
					<ActionForm action="?/leave" class="mt-3" onfail={(message) => (failed = message)}>
						<button
							type="submit"
							class="btn h-12 w-full rounded-lg border-[1.5px] border-surface-200-800 font-semibold hover:preset-tonal"
						>
							{m.table_leave()}
						</button>
					</ActionForm>
				{:else if data.myStatus === 'pending'}
					<p class="font-semibold">{m.table_request_pending()}</p>
					<ActionForm action="?/leave" class="mt-3" onfail={(message) => (failed = message)}>
						<button
							type="submit"
							class="btn h-12 w-full rounded-lg border-[1.5px] border-surface-200-800 font-semibold hover:preset-tonal"
						>
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
						<button
							type="submit"
							class="btn h-[52px] w-full rounded-lg preset-filled-primary-500 font-semibold"
						>
							{table.joinMode === 'approval' ? m.table_join_request() : m.table_join_now()}
						</button>
					</ActionForm>
				{/if}
			</div>
			<p class="mt-3 text-sm text-muted">
				{table.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}
			</p>
		</aside>
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
							class="flex items-center justify-between gap-4 rounded-lg border border-surface-200-800 bg-panel p-3"
						>
							<span>{atHandle(player.username)}</span>
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
							class="flex items-center justify-between gap-4 rounded-lg border border-surface-200-800 bg-panel p-3"
						>
							<span>{atHandle(request.username)}</span>
							<div class="flex gap-4">
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
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</article>
