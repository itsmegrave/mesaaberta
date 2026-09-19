<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();

	const providers = [
		{ id: 'google', label: m.login_with_google() },
		{ id: 'discord', label: m.login_with_discord() },
		{ id: 'github', label: m.login_with_github() }
	];
</script>

<svelte:head>
	<title>{m.login_title()}</title>
</svelte:head>

<section class="py-16 md:py-24">
	<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">{m.login_title()}</h1>
	<p class="mt-4 max-w-[44ch] text-lg">{m.login_lede()}</p>

	{#if data.failed}
		<p role="alert" class="mt-6 max-w-[44ch] font-semibold">{m.login_failed()}</p>
	{/if}

	{#if data.authEnabled}
		<ul class="mt-8 flex max-w-sm flex-col gap-3">
			{#each providers as provider (provider.id)}
				<li>
					<a
						href="{resolve('/login/[provider=provider]', {
							provider: provider.id
						})}?next={encodeURIComponent(data.next)}"
						class="block rounded bg-petrol px-4 py-3 text-center font-semibold text-celadon hover:bg-petrol/90"
					>
						{provider.label}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-8 max-w-[44ch]">{m.login_unavailable()}</p>
	{/if}
</section>
