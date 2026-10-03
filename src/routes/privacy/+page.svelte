<script lang="ts">
  import LegalPage from '$lib/components/LegalPage.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { controller, updated } from '$lib/legal';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  const locale = getLocale();
</script>

<svelte:head>
  <title>{m.privacy_title()} · Mesa Aberta</title>
  <meta name="description" content={m.privacy_description()} />
</svelte:head>

<LegalPage title={m.privacy_title()} {updated}>
  <p>
    Esta política explica quais dados pessoais a Mesa Aberta trata, para quê, com quem eles são
    compartilhados e como você exerce os seus direitos, conforme a Lei Geral de Proteção de Dados
    Pessoais (Lei nº 13.709/2018, a LGPD).
  </p>

  <h2>Quem cuida dos seus dados</h2>
  <p>
    O controlador dos dados é <strong>{controller.name}</strong>, responsável pela Mesa Aberta. Para
    qualquer assunto de privacidade, inclusive para falar com o encarregado, escreva para
    <a href="mailto:{controller.email}">{controller.email}</a>.
  </p>

  <h2>Quais dados tratamos</h2>
  <h3>Conta</h3>
  <ul>
    <li>
      Seu e-mail e, se você criar a conta com e-mail e senha, a senha (guardada só como hash pelo
      provedor de autenticação; nós nunca a vemos).
    </li>
    <li>
      Se você entrar com Google ou Discord, recebemos desse provedor o seu identificador, e-mail,
      nome e foto.
    </li>
  </ul>
  <h3>Perfil</h3>
  <ul>
    <li>Nome de usuário (obrigatório) e nome.</li>
    <li>Opcionais, só se você preencher: idade, gênero, cidade, foto e links de redes sociais.</li>
  </ul>
  <h3>Mesas e participação</h3>
  <ul>
    <li>
      As mesas que você abre: título, descrição, sistema, horários, fuso, vagas, imagem de capa,
      mensagem de boas-vindas, se é online ou presencial, bairro, cidade e CEP (presencial), e como
      entrar (link ou endereço, visível só para você e os jogadores confirmados).
    </li>
    <li>
      As mesas em que você entra ou pede vaga, a mensagem de apresentação do pedido, se escrever
      uma, e o andamento desses pedidos (aprovado, recusado, saída).
    </li>
    <li>As avaliações que você dá aos mestres, com o comentário, se escrever um.</li>
  </ul>
  <h3>Mensagens</h3>
  <ul>
    <li>
      O texto, o horário e o autor das mensagens que você envia, no chat das mesas de que participa
      e nas conversas diretas, e até onde você já leu cada conversa. Não guardamos anexos.
    </li>
    <li>Nas conversas diretas, quem escreve pode indicar sobre qual mesa está falando.</li>
  </ul>
  <h3>Dados técnicos</h3>
  <ul>
    <li>
      Registros de acesso (endereço IP, data e hora, página pedida e navegador), mantidos pela
      hospedagem para segurança e para diagnosticar erros. Nos nossos registros de aplicação,
      e-mails e outros dados pessoais são mascarados.
    </li>
    <li>
      Registro de conexão: a cada vez que você entra na conta, guardamos o endereço IP, a data e a
      hora, como pede o Marco Civil da Internet (art. 15).
    </li>
    <li>
      Contadores de uso por pessoa (por exemplo, quantas mesas você abriu na última hora), para
      limitar abusos.
    </li>
    <li>
      Contadores de tentativas por rede: quando alguém tenta entrar, criar conta ou recuperar a
      senha, guardamos um resumo criptográfico (hash) do endereço IP, não o endereço em si, para
      barrar tentativas em massa.
    </li>
  </ul>

  <h2>Para que usamos e com qual base legal</h2>
  <ul>
    <li>
      <strong
        >Criar e manter a sua conta, mostrar e organizar mesas, inscrições e avaliações, e enviar os
        convites de calendário e os avisos das mesas</strong
      >: execução do serviço que você pediu (art. 7º, V).
    </li>
    <li>
      <strong>Dados opcionais do perfil</strong>: seu consentimento, dado ao preencher o campo. Você
      pode apagá-los a qualquer momento na página do perfil.
    </li>
    <li>
      <strong>Segurança, prevenção de abuso e correção de erros</strong>: legítimo interesse (art.
      7º, IX).
    </li>
    <li>
      <strong>Guardar registros de acesso</strong>: cumprimento de obrigação legal (art. 7º, II;
      Marco Civil da Internet, art. 15).
    </li>
  </ul>
  <p>
    Não vendemos dados, não mostramos anúncios e não usamos seus dados para criar perfis de
    publicidade.
  </p>

  <h2>O que fica visível para outras pessoas</h2>
  <ul>
    <li>
      Nas mesas que você abre, qualquer visitante vê o seu nome de usuário como mestre e as notas
      médias da mesa e do mestre.
    </li>
    <li>
      O mestre de uma mesa vê o nome de usuário de quem entrou ou pediu vaga nela, e a mensagem de
      apresentação que a pessoa escreveu ao pedir.
    </li>
    <li>
      As mensagens só são vistas por quem participa da conversa: o mestre e os jogadores confirmados
      no chat de uma mesa, ou as duas pessoas de uma conversa direta. Quem sai da mesa perde o
      acesso ao chat. Você pode desligar as mensagens diretas no seu perfil.
    </li>
    <li>Os comentários das avaliações não são mostrados publicamente.</li>
    <li>Seu e-mail nunca fica visível para outras pessoas.</li>
  </ul>

  <h2>Com quem compartilhamos</h2>
  <p>Usamos estes fornecedores (operadores), só para fazer o serviço funcionar:</p>
  <ul>
    <li><strong>Supabase</strong>: banco de dados, autenticação e armazenamento de imagens.</li>
    <li><strong>Cloudflare</strong>: hospedagem, rede e proteção contra ataques.</li>
    <li>{m.privacy_provider_sentry()}</li>
    <li>{m.privacy_provider_mixpanel()}</li>
    <li>{m.privacy_provider_traffic()}</li>
    <li><strong>Resend</strong>: envio de e-mails (convites e avisos das mesas).</li>
    <li><strong>Google e Discord</strong>: só se você escolher entrar com eles.</li>
    <li>
      <strong>ViaCEP</strong>: recebe só o CEP de uma mesa presencial, para achar o bairro e a
      cidade. Guardamos a resposta para não perguntar de novo.
    </li>
  </ul>
  <p>Também compartilhamos dados se uma autoridade competente exigir, nos termos da lei.</p>

  <h2>Transferência internacional</h2>
  <p>
    Esses fornecedores guardam ou processam dados em servidores fora do Brasil, principalmente nos
    Estados Unidos e na União Europeia. A transferência é feita para executar o serviço que você
    pediu (art. 33, IX) e com fornecedores que adotam cláusulas contratuais de proteção de dados.
  </p>

  <h2>Cookies e armazenamento no navegador</h2>
  <ul>
    <li>
      <strong>Cookies de sessão</strong>, do provedor de autenticação: mantêm você conectado. São
      estritamente necessários; sem eles não é possível entrar na conta.
    </li>
    <li>
      <strong>Preferência de tema</strong> (claro ou escuro), guardada no armazenamento local do seu navegador.
      Não sai do seu aparelho.
    </li>
    <li>
      <strong>Fuso horário</strong>: um cookie com o fuso do seu navegador (por exemplo,
      America/Sao_Paulo), para mostrar os horários das mesas no seu fuso. Não identifica você e só é
      usado para isso. Se você escolher um fuso no perfil, vale o do perfil.
    </li>
  </ul>
  <p>
    Não usamos cookies de publicidade, de rastreamento ou de terceiros para análise. Por isso não
    pedimos consentimento para cookies. Se isso mudar, esta política e o site vão avisar antes.
  </p>

  <h2>Por quanto tempo guardamos</h2>
  <ul>
    <li>Dados da conta, do perfil, das mesas e das avaliações: enquanto a conta existir.</li>
    <li>
      Quando a conta é apagada, removemos o perfil, os links, as inscrições e as avaliações. As
      mesas que você abriu são desativadas e somem da plataforma.
    </li>
    <li>
      Registros de conexão (IP, data e hora de cada entrada na conta) e registros de acesso: por 6
      meses (Marco Civil da Internet, art. 15), depois são apagados.
    </li>
    <li>Registros internos dos avisos enviados pelas mesas: até 90 dias depois de processados.</li>
    <li>
      Notificações do sino (o que mudou nas suas mesas e nos seus pedidos de vaga): até 90 dias, e
      somem na hora se a conta for apagada.
    </li>
    <li>
      Mensagens: as conversas diretas ficam enquanto as contas existirem. O chat de uma mesa é
      apagado 90 dias depois de a mesa ser desativada. Quando você apaga a conta, as suas mensagens
      são apagadas e você sai de todas as conversas.
    </li>
    <li>Contadores de tentativas de entrada, cadastro e recuperação de senha: até 24 horas.</li>
  </ul>

  <h2>Seus direitos</h2>
  <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
  <ul>
    <li>confirmar se tratamos seus dados e acessá-los;</li>
    <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
    <li>pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou excessivos;</li>
    <li>receber seus dados em formato estruturado (portabilidade);</li>
    <li>eliminar os dados tratados com base no seu consentimento, e revogar esse consentimento;</li>
    <li>saber com quem compartilhamos seus dados;</li>
    <li>reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
  </ul>
  <p>
    Na <a href={localizedHref('/account/profile', locale)}>página do seu perfil</a> você corrige os
    seus dados, baixa uma cópia de tudo em JSON e apaga a conta. Para os outros pedidos, escreva
    para
    <a href="mailto:{controller.email}">{controller.email}</a> a partir do e-mail da sua conta. Respondemos
    em até 15 dias.
  </p>

  <h2>Segurança</h2>
  <p>
    Os dados trafegam sempre com criptografia (HTTPS), o acesso ao banco é restrito por regras de
    segurança por linha, e só a aplicação acessa os dados pessoais. Se acontecer um incidente de
    segurança que possa causar risco ou dano relevante, avisaremos você e a ANPD.
  </p>

  <h2>Crianças e adolescentes</h2>
  <p>
    A Mesa Aberta não é destinada a menores de 13 anos. Adolescentes entre 13 e 17 anos só devem
    usá-la com autorização e acompanhamento dos pais ou responsáveis.
  </p>

  <h2>Mudanças nesta política</h2>
  <p>
    Se mudarmos esta política, a data no topo desta página muda. Mudanças importantes serão avisadas
    no site ou por e-mail antes de valer. Veja também os
    <a href={localizedHref('/terms', locale)}>Termos de uso</a>.
  </p>
</LegalPage>
