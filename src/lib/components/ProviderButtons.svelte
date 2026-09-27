<script lang="ts">
	import { resolve } from '$app/paths';
	import ProviderLogo from './ProviderLogo.svelte';
	import { m } from '$lib/paraglide/messages';

	let { next }: { next: string } = $props();

	// Google: its own guidelines ask for a light button with the coloured G. Discord: its blurple with the white mark.
	const providers = $derived([
		{
			id: 'google' as const,
			label: m.login_with_google(),
			style: 'preset-outlined-surface-300-700 hover:preset-tonal'
		},
		{
			id: 'discord' as const,
			label: m.login_with_discord(),
			style: 'bg-[#5865F2] text-white hover:bg-[#4752c4]'
		}
	]);
</script>

<ul class="flex max-w-sm flex-col gap-3">
	{#each providers as provider (provider.id)}
		<li>
			<a
				href="{resolve('/login/[provider=provider]', {
					provider: provider.id
				})}?next={encodeURIComponent(next)}"
				class="btn w-full justify-center gap-3 {provider.style}"
			>
				<ProviderLogo provider={provider.id} />
				{provider.label}
			</a>
		</li>
	{/each}
</ul>
