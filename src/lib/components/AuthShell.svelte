<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import TableIllustration from './TableIllustration.svelte';

	// The frame of the sign-in pages (login, sign-up, password): the blue panel with the table on large
	// screens, and the page's own content on the right.
	let { title, lede, children }: { title: string; lede?: string; children: Snippet } = $props();
</script>

<section
	class="grid items-center gap-10 pt-2 pb-6 md:pt-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-24"
>
	<div
		class="relative hidden h-[660px] flex-col items-center justify-center gap-7 overflow-hidden rounded-lg bg-primary-500 p-10 text-white lg:flex"
	>
		<span
			aria-hidden="true"
			class="absolute -top-[120px] -right-[120px] size-[340px] rounded-full bg-white/6"
		></span>
		<div class="relative w-[340px]"><TableIllustration onBrand /></div>
		<p
			class="relative max-w-[16ch] text-center text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance"
		>
			{m.hero_title()}
		</p>
	</div>

	<div class="min-w-0">
		<h1
			class="text-[44px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-[64px]"
		>
			{title}
		</h1>
		{#if lede}<p class="mt-2.5 max-w-[40ch] text-lg text-muted md:mt-3 md:text-xl">{lede}</p>{/if}
		<div class="mt-7 w-full max-w-[440px] md:mt-8">
			{@render children()}
		</div>
	</div>
</section>
