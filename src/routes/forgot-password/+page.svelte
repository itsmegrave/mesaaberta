<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import { emailSchema } from '$lib/auth/credentials';
	import FormField from '$lib/components/FormField.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
	const { form, errors, message, enhance, delayed } = superForm(data.form, {
		validators: zod4Client(emailSchema)
	});
</script>

<svelte:head>
	<title>{m.forgot_title()}</title>
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.forgot_title()}</h1>

	{#if !data.authEnabled}
		<p class="mt-8 max-w-[44ch]">{m.login_unavailable()}</p>
	{:else if $message?.code === 'sent'}
		<div role="status" class="mt-8 max-w-[44ch]">
			<h2 class="text-2xl font-semibold">{m.forgot_sent_title()}</h2>
			<p class="mt-3 text-lg">{m.forgot_sent_text()}</p>
		</div>
	{:else}
		<p class="mt-4 max-w-[44ch] text-lg">{m.forgot_lede()}</p>

		{#if data.linkExpired}
			<p role="alert" class="mt-6 max-w-[44ch] font-semibold">{m.forgot_link_expired()}</p>
		{/if}

		<form method="POST" use:enhance class="mt-8 grid max-w-sm gap-5">
			{#if $message}
				<p role="alert" class="font-semibold text-error-700-300">
					{$message.code === 'rate_limited' ? m.auth_error_rate_limited() : m.auth_error_failed()}
				</p>
			{/if}

			<FormField
				id="email"
				label={m.auth_email()}
				error={$errors.email ? m.auth_error_email() : undefined}
			>
				<input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					bind:value={$form.email}
					class="input"
					aria-invalid={$errors.email ? 'true' : undefined}
				/>
			</FormField>

			<div>
				<button type="submit" class="btn w-full preset-filled-primary-500" aria-busy={$delayed}>
					{m.forgot_submit()}
				</button>
			</div>
		</form>
	{/if}

	<p class="mt-8">
		<a href={resolve('/login')} class="anchor">{m.forgot_back()}</a>
	</p>
</section>
