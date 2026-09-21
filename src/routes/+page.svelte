<script lang="ts">
	import TableIllustration from '$lib/components/TableIllustration.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const locale = getLocale();

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

<section class="flex items-center py-5 md:py-20">
	<div class="grid w-full items-center gap-10 md:grid-cols-2 md:gap-12">
		<div class="max-w-3xl">
			<p
				class="chip gap-2 border-0 bg-warning-500/20 px-3 text-sm font-semibold text-warning-700-300"
			>
				<span
					aria-hidden="true"
					class="size-3.5 rounded-full border-2 border-dashed border-warning-500"
				></span>
				Mesas de RPG com vagas abertas
			</p>
			<h1
				class="mt-4 max-w-[11ch] text-5xl leading-none font-semibold tracking-tight sm:text-6xl md:mt-6 md:text-7xl"
			>
				{m.hero_title_before()} <span class="text-warning-700-300">{m.hero_title_accent()}</span>
				{m.hero_title_after()}
			</h1>
			<p class="mt-4 max-w-[34ch] text-lg leading-relaxed md:mt-6 md:text-xl">
				{m.hero_lede()}
			</p>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
				<a
					href={localizedHref('/tables', locale)}
					class="btn h-14 w-full gap-2.5 preset-filled-primary-500 sm:w-auto"
				>
					{m.hero_browse_cta()}
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M5 12h14M13 6l6 6-6 6" />
					</svg>
				</a>
				<a
					href={localizedHref('/tables/new', locale)}
					class="btn h-14 w-full preset-outlined-primary-500 sm:w-auto">{m.hero_open_cta()}</a
				>
			</div>
		</div>
		<div class="mx-auto mt-1 w-full max-w-xs md:mt-0 md:max-w-md md:justify-self-end">
			<TableIllustration />
		</div>
	</div>
</section>

<section aria-labelledby="roles" class="py-14 md:py-20">
	<div class="max-w-[48ch]">
		<h2 id="roles" class="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
			O seu lugar, de qualquer lado da mesa.
		</h2>
	</div>
	<div class="mt-8 grid gap-5 md:grid-cols-2 md:gap-6">
		<article class="card border border-surface-200-800 bg-surface-100-900 p-6 md:p-8">
			<h3 class="text-2xl font-semibold">Para quem joga</h3>
			<p class="mt-3 max-w-[40ch]">
				Encontre uma cadeira vazia, entre na mesa e acompanhe cada sessão.
			</p>
			<div class="mt-6 rounded-2xl border border-surface-200-800 bg-surface-200-800 p-4">
				<p class="font-semibold">Uma vaga pode ser sua</p>
				<p class="mt-1 text-sm text-surface-700-300">Depois da sessão, você avalia o mestre.</p>
			</div>
			<a href={localizedHref('/tables', locale)} class="mt-6 btn preset-outlined-primary-500"
				>Ver mesas abertas</a
			>
		</article>

		<article class="relative overflow-hidden card preset-filled-primary-500 p-6 md:p-8">
			<span
				aria-hidden="true"
				class="absolute -top-20 -right-20 size-60 rounded-full bg-primary-contrast-500/10"
			></span>
			<div class="relative">
				<h3 class="text-2xl font-semibold">Para quem mestra</h3>
				<p class="mt-3 max-w-[40ch] opacity-90">
					Abra sua mesa, escolha como as pessoas entram e cuide da próxima sessão.
				</p>
				<div class="mt-6 rounded-2xl bg-white/10 p-4">
					<p class="font-semibold">Novo pedido de vaga</p>
					<p class="mt-1 text-sm opacity-80">Você aprova quem senta à sua mesa.</p>
				</div>
				<a href={localizedHref('/tables/new', locale)} class="mt-6 btn preset-outlined-primary-500"
					>Abrir uma mesa</a
				>
			</div>
		</article>
	</div>
</section>

<section aria-labelledby="open-tables" class="border-y border-surface-200-800 py-14 md:py-20">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 id="open-tables" class="text-3xl font-semibold tracking-tight md:text-4xl">
				Mesas com vaga
			</h2>
			<p class="mt-2 max-w-[44ch]">Escolha a próxima aventura que cabe na sua agenda.</p>
		</div>
		<a href={localizedHref('/tables', locale)} class="anchor">Ver todas as mesas</a>
	</div>
	<div
		class="mt-8 card border border-surface-200-800 bg-surface-100-900 p-6 md:flex md:items-center md:justify-between md:gap-8"
	>
		<div>
			<p class="text-xl font-semibold">Pronto para escolher uma aventura?</p>
			<p class="mt-2 max-w-[42ch]">Veja sistemas, horários e vagas antes de entrar na mesa.</p>
		</div>
		<a
			href={localizedHref('/tables', locale)}
			class="mt-5 btn shrink-0 preset-filled-primary-500 md:mt-0">Explorar mesas</a
		>
	</div>
</section>

<section aria-labelledby="how-it-works" class="py-14 md:py-20">
	<h2 id="how-it-works" class="text-3xl font-semibold tracking-tight md:text-4xl">
		{m.how_title()}
	</h2>
	<ol
		class="mt-8 grid list-decimal gap-8 pl-8 marker:text-3xl marker:font-semibold md:grid-cols-3 md:gap-12"
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

<section aria-labelledby="for-game-masters" class="pb-14 md:pb-20">
	<div
		class="card border border-surface-200-800 bg-surface-100-900 p-7 md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:p-12"
	>
		<h2
			id="for-game-masters"
			class="text-3xl leading-tight font-semibold tracking-tight md:text-4xl"
		>
			{m.gm_title()}
		</h2>
		<div>
			<p class="max-w-[52ch] text-lg">{m.gm_text()}</p>
			<a href={localizedHref('/tables/new', locale)} class="mt-6 inline-flex anchor"
				>Abrir uma mesa</a
			>
		</div>
	</div>
</section>
