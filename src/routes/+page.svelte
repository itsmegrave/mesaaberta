<script lang="ts">
	import TableIllustration from '$lib/components/TableIllustration.svelte';
	import { m } from '$lib/paraglide/messages';

	const steps = [
		{ title: m.how_step_1_title, text: m.how_step_1_text },
		{ title: m.how_step_2_title, text: m.how_step_2_text },
		{ title: m.how_step_3_title, text: m.how_step_3_text }
	];
</script>

<svelte:head>
	<title>{m.home_title()}</title>
	<meta name="description" content={m.home_description()} />
</svelte:head>

<section class="grid items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-16">
	<div>
		<h1 class="text-5xl leading-[0.95] font-semibold tracking-tight md:text-7xl">
			{m.hero_title()}
		</h1>
		<p class="mt-6 max-w-[34ch] text-xl">{m.hero_lede()}</p>
		<p class="mt-6 max-w-[44ch]">{m.hero_status()}</p>
		<p class="mt-6 max-w-[44ch]">
			{m.hero_open_source()}
			<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener" class="text-link">
				{m.hero_open_source_link()}</a
			>.
		</p>
	</div>
	<TableIllustration />
</section>

<section aria-labelledby="como-funciona" class="border-t border-petrol/15 py-12 md:py-16">
	<h2 id="como-funciona" class="text-3xl font-semibold tracking-tight md:text-4xl">
		{m.how_title()}
	</h2>
	<ol
		class="mt-8 grid list-decimal gap-8 pl-8 marker:font-display marker:text-3xl marker:font-semibold md:grid-cols-3 md:gap-12"
	>
		{#each steps as step (step.title)}
			<li class="pl-2">
				<h3 class="text-xl font-semibold">{step.title()}</h3>
				<p class="mt-2 max-w-[40ch]">{step.text()}</p>
			</li>
		{/each}
	</ol>
	<p class="mt-10">{m.how_after_session()}</p>
</section>

<section aria-labelledby="para-mestres" class="border-t border-petrol/15 py-12 md:py-16">
	<h2 id="para-mestres" class="text-3xl font-semibold tracking-tight md:text-4xl">
		{m.gm_title()}
	</h2>
	<p class="mt-4 max-w-[52ch] text-lg">{m.gm_text()}</p>
</section>
