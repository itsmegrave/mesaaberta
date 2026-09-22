<script lang="ts">
	import { tick } from 'svelte';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import FormField from './FormField.svelte';
	import { m } from '$lib/paraglide/messages';
	import { profileSchema, PROFILE_LIMITS, type ProfileInput } from '$lib/profile/schema';
	import { MAX_SOCIAL_LINKS, NETWORKS, type Network } from '$lib/profile/social-links';
	import { MAX_USERNAME_LENGTH, normalizeUsername, usernameProblem } from '$lib/profile/username';

	/** What the server says about a username: free, taken, or not acceptable at all. */
	export type Availability = 'free' | 'taken' | 'invalid';

	type Props = {
		form: SuperValidated<ProfileInput>;
		action?: string;
		/** Asks the server if a (well formed) username is free. Replaced in tests. */
		checkUsername?: (username: string, signal: AbortSignal) => Promise<Availability>;
	};

	const askServer = async (username: string, signal: AbortSignal): Promise<Availability> => {
		const response = await fetch(`/onboarding/username?value=${encodeURIComponent(username)}`, {
			signal,
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`availability check answered ${response.status}`);

		return ((await response.json()) as { status: Availability }).status;
	};

	let { form: initial, action, checkUsername = askServer }: Props = $props();

	// The form is set up once with what the server loaded; superforms keeps it up to date after that.
	// svelte-ignore state_referenced_locally
	const { form, errors, allErrors, enhance, submitting } = superForm(initial, {
		validators: zod4Client(profileSchema),
		resetForm: false
	});

	const input = 'block w-full rounded border border-ink/60 bg-surface px-3 py-2';
	const secondary =
		'rounded border border-ink/60 px-3 py-1 font-semibold hover:bg-petrol/10 disabled:opacity-50';

	const ERRORS: Record<string, () => string> = {
		required: m.profile_error_required,
		too_short: m.profile_error_too_short,
		too_long: m.profile_error_too_long,
		invalid_chars: m.profile_error_invalid_chars,
		hyphen_edges: m.profile_error_hyphen_edges,
		hyphen_double: m.profile_error_hyphen_double,
		reserved: m.profile_error_reserved,
		taken: m.profile_error_taken,
		invalid_url: m.profile_error_invalid_url,
		invalid_network: m.profile_error_invalid_network,
		duplicate: m.profile_error_duplicate,
		too_many: m.profile_error_too_many
	};
	const errorText = (code: string | undefined) =>
		code ? (ERRORS[code] ?? m.profile_error_invalid)() : undefined;

	const NETWORK_LABELS: Record<Network, () => string> = {
		instagram: m.network_instagram,
		x: m.network_x,
		bluesky: m.network_bluesky,
		facebook: m.network_facebook,
		tiktok: m.network_tiktok,
		youtube: m.network_youtube,
		twitch: m.network_twitch,
		discord: m.network_discord,
		github: m.network_github,
		linkedin: m.network_linkedin,
		website: m.network_website
	};

	// Superforms keeps an array's own errors under `_errors` and each item's under its index.
	const itemError = (field: 'linkNetwork' | 'linkUrl', index: number) =>
		errorText(($errors[field] as Record<number, string[] | undefined> | undefined)?.[index]?.[0]);
	const listError = () =>
		errorText(($errors.linkUrl as { _errors?: string[] } | undefined)?._errors?.[0]);

	// --- the username, checked against the server while it is typed --------------------------------

	const CHECK_DELAY_MS = 400;
	let availability = $state<'idle' | 'checking' | Availability | 'failed'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let request: AbortController | undefined;

	function usernameChanged() {
		clearTimeout(timer);
		request?.abort();
		availability = 'idle';

		// A username that is wrong anyway is not worth a round trip: the form says what is wrong.
		if (usernameProblem($form.username) !== null) return;

		availability = 'checking';
		timer = setTimeout(async () => {
			request = new AbortController();
			const { signal } = request;
			try {
				const status = await checkUsername(normalizeUsername($form.username), signal);
				if (!signal.aborted) availability = status;
			} catch {
				if (!signal.aborted) availability = 'failed';
			}
		}, CHECK_DELAY_MS);
	}

	// A username that arrives already filled in (a suggestion made from the sign-in name) is checked too.
	if ($form.username !== '') usernameChanged();

	const usernameError = $derived(
		errorText($errors.username?.[0]) ??
			(availability === 'taken' ? m.profile_error_taken() : undefined)
	);
	const usernameDescription = $derived(
		['username-hint', usernameError ? 'username-error' : 'username-status'].join(' ')
	);

	// --- the links: a list to add to, remove from and reorder -------------------------------------

	// Each row keeps an id of its own, so a row that moves keeps what was typed in it and its focus.
	let nextId = 0;
	let ids = $state($form.linkNetwork.map(() => nextId++));
	let announcement = $state('');
	let addButton: HTMLButtonElement | undefined = $state();

	const canAdd = $derived(ids.length < MAX_SOCIAL_LINKS);

	function addLink() {
		$form.linkNetwork = [...$form.linkNetwork, 'instagram'];
		$form.linkUrl = [...$form.linkUrl, ''];
		const id = nextId++;
		ids.push(id);

		tick().then(() => document.getElementById(`link-url-${id}`)?.focus());
	}

	function removeLink(index: number) {
		$form.linkNetwork = $form.linkNetwork.filter((_, i) => i !== index);
		$form.linkUrl = $form.linkUrl.filter((_, i) => i !== index);
		ids.splice(index, 1);
		announcement = m.profile_link_removed();

		// The row that had the focus is gone: keep the focus in the list.
		tick().then(() => addButton?.focus());
	}

	function moveLink(index: number, by: -1 | 1) {
		const to = index + by;
		const swap = <T,>(list: T[]) => {
			const copy = [...list];
			[copy[index], copy[to]] = [copy[to], copy[index]];
			return copy;
		};

		$form.linkNetwork = swap($form.linkNetwork);
		$form.linkUrl = swap($form.linkUrl);
		ids = swap(ids);
		announcement = m.profile_link_moved({ n: index + 1, position: to + 1 });
	}
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and stop superforms from validating (it skips a form the browser is asked to check). -->
<form method="POST" {action} use:enhance class="grid max-w-xl gap-6">
	{#if $allErrors.length > 0}
		<p role="alert" class="text-danger font-semibold">{m.profile_error_form()}</p>
	{/if}

	<FormField
		id="username"
		label={m.profile_username()}
		hint={m.profile_username_hint()}
		error={usernameError}
	>
		<input
			id="username"
			name="username"
			type="text"
			aria-required="true"
			maxlength={MAX_USERNAME_LENGTH}
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			bind:value={$form.username}
			oninput={usernameChanged}
			class={input}
			aria-invalid={usernameError ? 'true' : undefined}
			aria-describedby={usernameDescription}
		/>
		<!-- Announced politely as the check finishes; it never blocks the form. -->
		<p id="username-status" role="status" class="mt-1 min-h-6 text-sm">
			{#if availability === 'checking'}
				{m.profile_username_checking()}
			{:else if availability === 'free'}
				{m.profile_username_free()}
			{:else if availability === 'failed'}
				{m.profile_username_check_failed()}
			{/if}
		</p>
	</FormField>

	<FormField
		id="name"
		label={m.profile_name()}
		hint={m.profile_name_hint()}
		error={errorText($errors.name?.[0])}
	>
		<input
			id="name"
			name="name"
			type="text"
			maxlength={PROFILE_LIMITS.name}
			autocomplete="name"
			bind:value={$form.name}
			class={input}
			aria-invalid={$errors.name ? 'true' : undefined}
			aria-describedby="name-hint{$errors.name ? ' name-error' : ''}"
		/>
	</FormField>

	<div class="grid gap-6 sm:grid-cols-2">
		<FormField
			id="age"
			label={m.profile_age()}
			hint={m.profile_optional()}
			error={$errors.age ? m.profile_error_age() : undefined}
		>
			<input
				id="age"
				name="age"
				type="number"
				inputmode="numeric"
				bind:value={$form.age}
				class={input}
				aria-invalid={$errors.age ? 'true' : undefined}
				aria-describedby="age-hint{$errors.age ? ' age-error' : ''}"
			/>
		</FormField>

		<FormField
			id="gender"
			label={m.profile_gender()}
			hint={m.profile_optional()}
			error={errorText($errors.gender?.[0])}
		>
			<input
				id="gender"
				name="gender"
				type="text"
				maxlength={PROFILE_LIMITS.gender}
				bind:value={$form.gender}
				class={input}
				aria-invalid={$errors.gender ? 'true' : undefined}
				aria-describedby="gender-hint{$errors.gender ? ' gender-error' : ''}"
			/>
		</FormField>
	</div>

	<FormField
		id="city"
		label={m.profile_city()}
		hint={m.profile_optional()}
		error={errorText($errors.city?.[0])}
	>
		<input
			id="city"
			name="city"
			type="text"
			maxlength={PROFILE_LIMITS.city}
			autocomplete="address-level2"
			bind:value={$form.city}
			class={input}
			aria-invalid={$errors.city ? 'true' : undefined}
			aria-describedby="city-hint{$errors.city ? ' city-error' : ''}"
		/>
	</FormField>

	<fieldset class="grid gap-3" aria-describedby="links-hint">
		<legend class="font-semibold">{m.profile_links()}</legend>
		<p id="links-hint" class="text-sm">{m.profile_links_hint()}</p>

		{#if listError()}
			<p role="alert" class="text-danger text-sm font-semibold">{listError()}</p>
		{/if}

		{#if ids.length === 0}
			<p class="text-sm">{m.profile_links_empty()}</p>
		{/if}

		<ul class="grid gap-4">
			{#each ids as id, index (id)}
				{@const urlError = itemError('linkUrl', index)}
				{@const networkError = itemError('linkNetwork', index)}
				<li class="border-ink/30 grid gap-2 rounded border p-3">
					<div class="grid gap-2 sm:grid-cols-[10rem_1fr]">
						<!-- A native <select>: a positioned popup would need inline styles, which the CSP forbids. -->
						<select
							name="linkNetwork"
							aria-label={m.profile_link_network({ n: index + 1 })}
							bind:value={$form.linkNetwork[index]}
							class={input}
							aria-invalid={networkError ? 'true' : undefined}
						>
							{#each NETWORKS as network (network)}
								<option value={network}>{NETWORK_LABELS[network]()}</option>
							{/each}
						</select>
						<input
							id="link-url-{id}"
							name="linkUrl"
							type="text"
							inputmode="url"
							autocapitalize="none"
							spellcheck="false"
							placeholder="https://"
							aria-label={m.profile_link_url({ n: index + 1 })}
							bind:value={$form.linkUrl[index]}
							class={input}
							aria-invalid={urlError ? 'true' : undefined}
							aria-describedby={urlError ? `link-error-${id}` : undefined}
						/>
					</div>
					{#if urlError || networkError}
						<p id="link-error-{id}" role="alert" class="text-danger text-sm font-semibold">
							{urlError ?? networkError}
						</p>
					{/if}
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class={secondary}
							disabled={index === 0}
							aria-label={m.profile_link_up({ n: index + 1 })}
							onclick={() => moveLink(index, -1)}
						>
							<span aria-hidden="true">↑</span>
						</button>
						<button
							type="button"
							class={secondary}
							disabled={index === ids.length - 1}
							aria-label={m.profile_link_down({ n: index + 1 })}
							onclick={() => moveLink(index, 1)}
						>
							<span aria-hidden="true">↓</span>
						</button>
						<button
							type="button"
							class={secondary}
							aria-label={m.profile_link_remove({ n: index + 1 })}
							onclick={() => removeLink(index)}
						>
							<span aria-hidden="true">×</span>
						</button>
					</div>
				</li>
			{/each}
		</ul>

		<div>
			<button
				type="button"
				class={secondary}
				disabled={!canAdd}
				bind:this={addButton}
				onclick={addLink}
			>
				{m.profile_link_add()}
			</button>
		</div>
		<p class="sr-only" role="status">{announcement}</p>
	</fieldset>

	<div>
		<button
			type="submit"
			disabled={$submitting}
			class="bg-petrol text-on-petrol w-full rounded px-5 py-3 font-semibold disabled:opacity-60 sm:w-auto"
		>
			{m.profile_submit()}
		</button>
	</div>
</form>
