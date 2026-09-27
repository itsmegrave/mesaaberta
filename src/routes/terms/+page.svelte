<script lang="ts">
	import LegalPage from '$lib/components/LegalPage.svelte';
	import { localizedHref } from '$lib/i18n/locales';
	import { controller, updated } from '$lib/legal';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	const locale = getLocale();
</script>

<svelte:head>
	<title>{m.terms_title()} · Mesa Aberta</title>
	<meta name="description" content={m.terms_description()} />
</svelte:head>

<LegalPage title={m.terms_title()} {updated}>
	<p>
		Estes termos valem para quem usa a Mesa Aberta, a plataforma em que mestres abrem mesas de RPG e
		jogadores pegam as vagas. Ao criar uma conta ou entrar nela, você concorda com eles e com a
		<a href={localizedHref('/privacy', locale)}>Política de privacidade</a>.
	</p>

	<h2>O serviço</h2>
	<p>
		A Mesa Aberta é gratuita e mantida por {controller.name}. Ela ajuda a encontrar, organizar e
		divulgar mesas: mostra horários e vagas, gerencia inscrições e envia convites de calendário. As
		sessões em si acontecem fora da plataforma, entre o mestre e os jogadores.
	</p>
	<p>
		O serviço é oferecido como está. Fazemos o possível para mantê-lo no ar e correto, mas ele pode
		mudar, ficar fora do ar ou ter erros.
	</p>

	<h2>Sua conta</h2>
	<ul>
		<li>
			Você precisa ter pelo menos 13 anos. Entre 13 e 17, só com autorização dos responsáveis.
		</li>
		<li>Use dados verdadeiros e mantenha o acesso à conta em segurança.</li>
		<li>Você responde pelo que é feito com a sua conta.</li>
	</ul>

	<h2>Convivência</h2>
	<p>A Mesa Aberta é feita pela comunidade, para a comunidade. Não é permitido:</p>
	<ul>
		<li>assediar, ameaçar, discriminar ou expor outras pessoas;</li>
		<li>
			publicar conteúdo ilegal, sexual envolvendo menores, de ódio ou que viole direitos de outros;
		</li>
		<li>usar mesas para vender produtos, fazer spam ou aplicar golpes;</li>
		<li>
			criar contas falsas, se passar por outra pessoa ou burlar os limites de uso da plataforma;
		</li>
		<li>tentar invadir, sobrecarregar ou atrapalhar o funcionamento do serviço.</li>
	</ul>
	<p>
		Se alguém desrespeitar estas regras, podemos remover conteúdo, desativar mesas e suspender ou
		encerrar contas. Para denunciar algo, escreva para
		<a href="mailto:{controller.email}">{controller.email}</a>.
	</p>

	<h2>Mesas e sessões</h2>
	<ul>
		<li>
			O mestre é responsável pela mesa que abre: pelas informações dela, pelo horário, pelas regras
			da sessão e pela forma como conduz o jogo.
		</li>
		<li>
			Jogadores e mestres combinam entre si o que acontece na sessão. A Mesa Aberta não participa,
			não modera as sessões e não responde pelo que acontece nelas.
		</li>
		<li>
			Avaliações devem refletir a sua experiência real na mesa. Avaliações falsas ou ofensivas podem
			ser removidas.
		</li>
	</ul>

	<h2>Seu conteúdo</h2>
	<p>
		O que você publica (textos das mesas, imagens de capa, avaliações) continua seu. Você nos
		autoriza a guardar, exibir e divulgar esse conteúdo dentro da plataforma, só para fazer o
		serviço funcionar. Publique apenas o que você tem direito de usar.
	</p>

	<h2>Código aberto</h2>
	<p>
		O código da Mesa Aberta é aberto, sob a licença MIT, e está no
		<a href="https://github.com/itsmegrave/mesaaberta" rel="noopener">GitHub</a>. A licença vale
		para o código, não para o conteúdo publicado pelas pessoas nem para os dados delas.
	</p>

	<h2>Encerrar a conta</h2>
	<p>
		Você pode pedir para apagar a sua conta a qualquer momento, escrevendo para
		<a href="mailto:{controller.email}">{controller.email}</a>. O que acontece com os seus dados
		está na <a href={localizedHref('/privacy', locale)}>Política de privacidade</a>.
	</p>

	<h2>Responsabilidade</h2>
	<p>
		Na medida permitida pela lei, a Mesa Aberta não responde por danos causados por sessões, por
		conteúdo publicado por outras pessoas ou por o serviço ficar fora do ar. Nada nestes termos
		limita os seus direitos como consumidor.
	</p>

	<h2>Mudanças e lei aplicável</h2>
	<p>
		Se mudarmos estes termos, a data no topo desta página muda. Mudanças importantes serão avisadas
		no site ou por e-mail antes de valer. Estes termos seguem a lei brasileira, e o foro é o do seu
		domicílio.
	</p>
</LegalPage>
