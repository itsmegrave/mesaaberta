<script lang="ts">
  // "Primeira mesa": what an RPG table is, how to pick and join one, and what happens on the day,
  // for people who never played. Its text is the page's own, like the terms.
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Prose from '#lib/components/ui/Prose.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { BEGINNER_TABLES_HREF } from '@mesaaberta/core/tables/beginners';
</script>

<svelte:head>
  <title>{m.beginners_title()} · Mesa Aberta</title>
  <meta name="description" content={m.beginners_lede()} />
</svelte:head>

<article class="mx-auto max-w-prose py-8 md:py-14">
  <Breadcrumbs items={[{ label: m.beginners_title() }]} class="mb-6" />
  <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {m.beginners_title()}
  </h1>
  <p class="mt-3 text-base text-muted md:text-xl">{m.beginners_lede()}</p>

  <div class="mt-6 flex flex-col gap-3 sm:flex-row">
    <a href={BEGINNER_TABLES_HREF} class="{buttonClass('primary', 'md')} gap-2 font-semibold">
      <Icon name="game-icons:sprout" size={20} />
      {m.beginners_cta()}
    </a>
  </div>

  <Prose class="mt-8 md:mt-10">
    <h2>O que é uma mesa de RPG</h2>
    <p>
      Num RPG, um grupo conta uma história junto. Cada pessoa vive uma personagem e diz o que ela
      faz; quem mestra descreve o mundo, faz as outras personagens e decide o que acontece. Os dados
      entram quando o resultado é incerto. Não tem quem ganha ou perde: o objetivo é a história
      ficar boa para todo mundo.
    </p>
    <p>
      Uma <strong>mesa</strong> é esse grupo, com dia e hora marcados. Pode ser online (por voz, em plataformas
      como Discord) ou presencial, numa loja ou na casa de alguém.
    </p>

    <h2>Como escolher a primeira</h2>
    <ul>
      <li>
        Procure o selo <strong>Iniciantes</strong>. Quem mestra marcou que explica as regras e que
        ninguém precisa saber jogar.
      </li>
      <li>
        Uma <strong>sessão única</strong> (one-shot) é o jeito mais leve de começar: uma história com
        começo, meio e fim num dia só, sem compromisso de voltar.
      </li>
      <li>
        Leia a descrição: o tom (terror, aventura, humor), a classificação indicativa e as
        ferramentas de segurança que a mesa usa.
      </li>
      <li>
        Não se preocupe com o sistema. Quem mestra mostra o que você precisa saber, e muitas mesas
        já têm fichas prontas.
      </li>
    </ul>

    <h2>Como entrar</h2>
    <ol>
      <li>Abra a mesa e toque em <strong>Entrar na mesa</strong>.</li>
      <li>
        Algumas mesas entram na hora; em outras, quem mestra aprova cada pedido. Você recebe um
        aviso quando entrar.
      </li>
      <li>
        A mesa ganha um chat para combinar os detalhes, e o convite chega no seu e-mail para pôr na
        agenda.
      </li>
      <li>
        Mesa cheia? Entre na <strong>lista de espera</strong>: se abrir uma vaga, ela é sua.
      </li>
    </ol>

    <h2>No dia</h2>
    <ul>
      <li>
        Chegue alguns minutos antes, teste o áudio e deixe à mão papel, lápis ou dados virtuais.
      </li>
      <li>
        Diga que é sua primeira vez. Ninguém espera que você saiba as regras, e perguntar faz parte.
      </li>
      <li>
        Se algo te deixar desconfortável, use as ferramentas de segurança da mesa (como a Carta X)
        ou fale com quem mestra. Você pode parar quando quiser.
      </li>
      <li>
        Não vai conseguir ir? Saia da mesa ou avise no chat, para a vaga ir para outra pessoa.
      </li>
    </ul>

    <h2>E depois</h2>
    <p>
      Gostou? Avalie a mesa, siga quem mestrou para saber das próximas e procure uma campanha, que
      continua por várias sessões. Sem mesa no momento? Marque <strong>Estou procurando mesa</strong
      >
      no Procuro mesa para quem mestra te encontrar.
    </p>
  </Prose>

  <div class="mt-10 rounded-lg border border-surface-200-800 bg-panel p-5">
    <p class="font-semibold">{m.beginners_ready()}</p>
    <a href={BEGINNER_TABLES_HREF} class="mt-3 {buttonClass('primary', 'md')} gap-2 font-semibold">
      {m.beginners_cta()}
      <Icon name="arrow-right" size={20} />
    </a>
  </div>
</article>
