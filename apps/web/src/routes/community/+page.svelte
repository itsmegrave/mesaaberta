<script lang="ts">
  import LegalPage from '#lib/components/ui/LegalPage.svelte';
  import { page } from '$app/state';
  import { controllerOf } from '#lib/legal.js';
  import { m } from '#lib/paraglide/messages.js';

  const controller = $derived(controllerOf(page.data.site));
  const updated = { iso: '2026-11-12', label: '12 de novembro de 2026' };
</script>

<LegalPage title={m.community_title()} {updated}>
  <p>
    A Mesa Aberta junta gente que quer jogar RPG. Estas regras valem para todo mundo, em mesas,
    mensagens, perfis e no Combinar. Elas completam os <a href="/terms">Termos de uso</a>.
  </p>

  <h2>O básico</h2>
  <ul>
    <li>Trate as pessoas como gostaria de ser tratado na mesa.</li>
    <li>
      Nada de assédio, ameaça, discriminação, discurso de ódio ou exposição de dados de outra
      pessoa.
    </li>
    <li>Combine limites e linhas antes de jogar e respeite o que for combinado.</li>
    <li>Não venda, não faça spam e não use a plataforma para golpes.</li>
  </ul>

  <h2>No Combinar</h2>
  <ul>
    <li>
      O Combinar é só para maiores de 18 anos. Quem declarou outra faixa de idade não entra, e quem
      mentir sobre a idade perde a conta.
    </li>
    <li>
      É para achar gente para jogar, não para paquera. Convites românticos ou sexuais não são
      bem-vindos.
    </li>
    <li>
      Um "Quero jogar junto" fica em segredo até as duas pessoas dizerem sim. Ninguém fica sabendo
      de um "Agora não".
    </li>
    <li>
      Combinou e não rolou? Desfaça a combinação. A outra pessoa não é avisada, e vocês saem do
      baralho um do outro.
    </li>
    <li>
      Para a primeira sessão, prefira jogar online ou em um lugar público. Não passe endereço,
      telefone ou documentos antes de se sentir à vontade.
    </li>
  </ul>

  <h2>Se algo der errado</h2>
  <p>
    No perfil de qualquer pessoa você pode <strong>Bloquear</strong> (ela some do seu baralho, das
    suas mensagens e você do dela) e <strong>Denunciar</strong>. Lemos toda denúncia. Quem quebrar
    estas regras pode ter conteúdo removido e a conta suspensa ou encerrada. Se for urgente, escreva
    para <a href="mailto:{controller.email}">{controller.email}</a>.
  </p>
</LegalPage>
