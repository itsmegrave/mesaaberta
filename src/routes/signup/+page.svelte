<script lang="ts">
	import { resolve } from '$app/paths';
	import CredentialsForm from '$lib/components/CredentialsForm.svelte';
	import ProviderButtons from '$lib/components/ProviderButtons.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m.signup_title()}</title>
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.signup_title()}</h1>

	{#if !data.authEnabled}
		<p class="mt-8 max-w-[44ch]">{m.login_unavailable()}</p>
	{:else if form?.checkEmail}
		<div role="status" class="mt-8 max-w-[44ch]">
			<h2 class="text-2xl font-semibold">{m.signup_check_email_title()}</h2>
			<p class="mt-3 text-lg">{m.signup_check_email_text()}</p>
			<a
				href="{resolve('/login')}?next={encodeURIComponent(data.next)}"
				class="mt-4 inline-block text-link"
			>
				{m.signup_sign_in()}
			</a>
		</div>
	{:else}
		<p class="mt-4 max-w-[44ch] text-lg">{m.signup_lede()}</p>

		<div class="mt-8 grid max-w-sm gap-8">
			<CredentialsForm
				mode="signup"
				next={data.next}
				email={form?.email}
				errors={form?.errors}
				result={form?.result}
			/>

			<p class="flex items-center gap-3" aria-hidden="true">
				<span class="h-px grow bg-petrol/30"></span>
				<span class="text-sm">{m.login_or()}</span>
				<span class="h-px grow bg-petrol/30"></span>
			</p>

			<ProviderButtons next={data.next} />

			<p>
				{m.signup_have_account()}
				<a href="{resolve('/login')}?next={encodeURIComponent(data.next)}" class="text-link">
					{m.signup_sign_in()}
				</a>
			</p>
		</div>
	{/if}
</section>
