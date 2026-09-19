<script lang="ts">
	import TableIllustration from '$lib/components/TableIllustration.svelte';

	const steps = [
		{
			title: 'Escolha uma mesa',
			text: 'Veja o sistema, se é campanha ou one-shot, o horário e quantas vagas restam.'
		},
		{
			title: 'Pegue sua vaga',
			text: 'Entre na hora ou peça ao mestre, conforme a mesa. Você acompanha tudo na sua conta.'
		},
		{
			title: 'Receba o convite',
			text: 'O evento chega no seu calendário e se atualiza se o mestre mudar algo.'
		}
	];
</script>

<svelte:head>
	<title>Mesa Aberta: mesas de RPG com vagas abertas</title>
	<meta
		name="description"
		content="Mestres abrem mesas de RPG, jogadores pegam a vaga e o convite chega no calendário."
	/>
</svelte:head>

<section class="grid items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-16">
	<div>
		<h1 class="text-5xl leading-[0.95] font-semibold tracking-tight md:text-7xl">
			Tem uma cadeira vazia na mesa.
		</h1>
		<p class="mt-6 max-w-[34ch] text-xl">
			Mestres abrem mesas de RPG. Jogadores pegam a vaga. O convite chega direto no calendário.
		</p>
		<p class="mt-6 max-w-[44ch]">
			Estamos montando a plataforma. As primeiras mesas abrem em breve.
		</p>
		<p class="mt-6 max-w-[44ch]">
			Mesa Aberta é um projeto de código aberto, sob a licença MIT.
			<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener" class="text-link">
				Veja o código no GitHub</a
			>.
		</p>
	</div>
	<TableIllustration />
</section>

<section aria-labelledby="como-funciona" class="border-t border-petrol/15 py-12 md:py-16">
	<h2 id="como-funciona" class="text-3xl font-semibold tracking-tight md:text-4xl">
		Como funciona
	</h2>
	<ol
		class="mt-8 grid list-decimal gap-8 pl-8 marker:font-display marker:text-3xl marker:font-semibold md:grid-cols-3 md:gap-12"
	>
		{#each steps as step (step.title)}
			<li class="pl-2">
				<h3 class="text-xl font-semibold">{step.title}</h3>
				<p class="mt-2 max-w-[40ch]">{step.text}</p>
			</li>
		{/each}
	</ol>
	<p class="mt-10">Depois da sessão, você avalia a mesa e o mestre.</p>
</section>

<section aria-labelledby="para-mestres" class="border-t border-petrol/15 py-12 md:py-16">
	<h2 id="para-mestres" class="text-3xl font-semibold tracking-tight md:text-4xl">
		Para quem mestra
	</h2>
	<p class="mt-4 max-w-[52ch] text-lg">
		Abra uma mesa em poucos minutos: escolha o sistema, defina horário e vagas, e decida se os
		jogadores entram direto ou com a sua aprovação. Você vê quem entrou, remove jogadores quando
		precisar e acompanha as avaliações.
	</p>
</section>
