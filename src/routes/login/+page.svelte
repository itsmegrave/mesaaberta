<script lang="ts">
	import { resolve } from '$app/paths';
	import CredentialsForm from '$lib/components/CredentialsForm.svelte';
	import ProviderButtons from '$lib/components/ProviderButtons.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m.login_title()}</title>
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.login_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.login_lede()}</p>

	{#if data.failed}
		<p role="alert" class="mt-6 max-w-[44ch] font-semibold">
			{data.confirmHint ? m.login_confirmed_hint() : m.login_failed()}
		</p>
	{/if}

	{#if data.authEnabled}
		<div class="mt-8 grid max-w-sm gap-8">
			<CredentialsForm
				mode="login"
				next={data.next}
				action="?/email"
				email={form?.email}
				errors={form?.errors}
				result={form?.result}
			/>

			<p class="-mt-3 text-sm">
				<a href={resolve('/forgot-password')} class="text-link">{m.login_forgot()}</a>
			</p>

			<p class="flex items-center gap-3" aria-hidden="true">
				<span class="h-px grow bg-petrol/30"></span>
				<span class="text-sm">{m.login_or()}</span>
				<span class="h-px grow bg-petrol/30"></span>
			</p>

			<ProviderButtons next={data.next} />

			<p>
				{m.login_no_account()}
				<a href="{resolve('/signup')}?next={encodeURIComponent(data.next)}" class="text-link">
					{m.login_create_account()}
				</a>
			</p>
		</div>
	{:else}
		<p class="mt-8 max-w-[44ch]">{m.login_unavailable()}</p>
	{/if}
</section>
