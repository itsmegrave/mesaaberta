<script lang="ts">
	import { resolve } from '$app/paths';
	import CredentialsForm from '$lib/components/CredentialsForm.svelte';
	import ProviderButtons from '$lib/components/ProviderButtons.svelte';
	import TableIllustration from '$lib/components/TableIllustration.svelte';
	import { m } from '$lib/paraglide/messages';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{m.login_title()}</title>
</svelte:head>

<section class="py-10 md:py-16">
	<div
		class="overflow-hidden rounded-[32px] border border-line bg-surface lg:grid lg:grid-cols-[0.92fr_minmax(0,1fr)]"
	>
		<div
			class="order-first flex min-h-[255px] items-center justify-center bg-petrol p-7 text-on-petrol sm:min-h-[310px] lg:order-none lg:min-h-full lg:p-12"
		>
			<div class="relative w-full max-w-sm">
				<div class="absolute inset-0 -m-12 rounded-full bg-sage/15 blur-3xl"></div>
				<TableIllustration />
				<p class="relative mt-3 text-center font-display text-xl font-semibold sm:text-2xl">
					Uma cadeira pode estar esperando por você.
				</p>
			</div>
		</div>
		<div class="p-6 sm:p-10 md:p-14">
			<p class="font-display text-sm font-semibold text-lamp">Mesa Aberta</p>
			<h1 class="text-4xl font-semibold tracking-tight md:text-5xl">{m.login_title()}</h1>
			<p class="mt-4 max-w-[36ch] text-lg">{m.login_lede()}</p>

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
		</div>
	</div>
</section>
