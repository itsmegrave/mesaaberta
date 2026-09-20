<script lang="ts">
	import { resolve } from '$app/paths';
	import FormField from '$lib/components/FormField.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data, form } = $props();

	const input = 'block w-full rounded border border-ink/60 bg-surface px-3 py-2';
	const errors = $derived(form?.errors ?? {});
	const problem = $derived(
		form?.result === 'weak_password'
			? m.auth_error_weak()
			: form?.result === 'same_password'
				? m.auth_error_same()
				: form?.result === 'rate_limited'
					? m.auth_error_rate_limited()
					: form?.result
						? m.auth_error_failed()
						: null
	);
</script>

<svelte:head>
	<title>{m.reset_title()}</title>
</svelte:head>

<section class="py-16 md:py-24">
	{#if data.done}
		<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.reset_done_title()}</h1>
		<p role="status" class="mt-4 max-w-[44ch] text-lg">{m.reset_done_text()}</p>
		<a href={localizedHref('/tables', getLocale())} class="mt-6 inline-block text-link">
			{m.reset_done_link()}
		</a>
	{:else}
		<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.reset_title()}</h1>
		<p class="mt-4 max-w-[44ch] text-lg">{m.reset_lede()}</p>

		<form method="POST" class="mt-8 grid max-w-sm gap-5">
			{#if problem}<p role="alert" class="font-semibold text-danger">{problem}</p>{/if}

			<FormField
				id="password"
				label={m.reset_password()}
				hint={m.auth_password_hint()}
				error={errors.password ? m.auth_error_password() : undefined}
			>
				<input
					id="password"
					name="password"
					type="password"
					required
					minlength="8"
					maxlength="72"
					autocomplete="new-password"
					class={input}
					aria-invalid={errors.password ? 'true' : undefined}
				/>
			</FormField>

			<FormField
				id="passwordConfirm"
				label={m.reset_confirm()}
				error={errors.passwordConfirm ? m.auth_error_mismatch() : undefined}
			>
				<input
					id="passwordConfirm"
					name="passwordConfirm"
					type="password"
					required
					minlength="8"
					maxlength="72"
					autocomplete="new-password"
					class={input}
					aria-invalid={errors.passwordConfirm ? 'true' : undefined}
				/>
			</FormField>

			<div>
				<button
					type="submit"
					class="w-full rounded bg-petrol px-5 py-3 font-semibold text-on-petrol"
				>
					{m.reset_submit()}
				</button>
			</div>
		</form>

		<p class="mt-8"><a href={resolve('/login')} class="text-link">{m.forgot_back()}</a></p>
	{/if}
</section>
