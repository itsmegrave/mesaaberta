# Voz da Mesa Aberta

> **Rascunho, aguardando aprovação.** Este guia é o primeiro passo do card #103. O dono do projeto aprova o texto antes de qualquer revisão em massa. Sozinho, ele não muda nenhuma string: cada ajuste em `messages/pt-BR.json` vem num PR próprio.

Vale para todo texto que alguém lê na Mesa Aberta: botões, formulários, avisos, erros, e-mails, notificações e o changelog. Na dúvida, copie o padrão de uma string que já segue o guia.

## Tom

Sóbrio, direto e amigável. Falamos como alguém da mesa explicando as regras da casa, sem vender nada.

- Frases curtas. Uma ideia por frase.
- Sem exclamação e sem empolgação ("incrível", "com sucesso", "prontinho").
- Diga o que aconteceu e, quando der, o que fazer agora.
- Erros não culpam a pessoa. Explicam o problema e o próximo passo.

| Evite                                          | Prefira                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Avaliação enviada com sucesso!                 | Avaliação salva.                                                                      |
| Vaga confirmada! O convite está no seu e-mail. | Vaga confirmada. O convite está no seu e-mail.                                        |
| Erro ao consultar CEP.                         | Não conseguimos consultar o CEP agora. Escreva o bairro e a cidade, ou tente de novo. |
| Erro inesperado.                               | Não deu certo. Tente de novo.                                                         |

## Tratamento

- Sempre **você**. Nunca "tu", "o usuário" ou "vocês" para uma pessoa só.
- Botões e CTAs no **imperativo**: "Abrir mesa", "Pedir vaga", "Enviar avaliação". Nos botões curtos, o infinitivo também serve ("Avaliar", "Mudar"); o que não entra é substantivo solto ("Envio", "Confirmação").
- **Caixa de frase**: só a primeira letra maiúscula, mais nomes próprios. "Ver mesas abertas", não "Ver Mesas Abertas".
- A plataforma fala na primeira pessoa do plural quando age: "enviamos um link", "Não conseguimos consultar o CEP".

## Linguagem neutra

Decisão do dono do projeto. Somos neutros **reformulando a frase para que o gênero não apareça**.

- **Não** usamos neopronomes ("todes", "elu") nem "x" ou "@" no lugar de vogal ("todxs", "tod@s").
- Modelo: "Para quem joga" / "Para quem mestra".
- **"Mestre"** fica como substantivo: a comunidade usa para qualquer pessoa. O que marca gênero é o artigo "o" e os adjetivos. Então: tire o artigo, use "quem mestra" ou fale direto com "você".
- **"Jogo"** e **"mesa"** podem representar a partida ou a mestragem: "Como foi o jogo?", "A mesa aprova cada entrada".
- **Avaliação é da mestragem**, não da mesa nem da pessoa. Onde aparece nota, deixe isso claro ("Nota de mestragem", "Avalie a mestragem").
- Plural: "os jogadores" vira "quem joga", "as pessoas na mesa" ou "quem tem vaga confirmada".
- Títulos de seção com pessoas: "Na mesa" ou "Participantes".
- O texto nunca depende do gênero de quem lê: não há escolha "mestre/mestra" no perfil. O campo de gênero que o perfil já tem (`profile_gender`) é um dado opcional e não muda nenhuma frase.

| Hoje                                 | Neutro                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| O mestre aprova cada entrada.        | A mesa aprova cada entrada. / Cada entrada passa por aprovação. |
| O mestre vai responder.              | Você recebe a resposta por e-mail.                              |
| Aguardando o mestre                  | Aguardando aprovação                                            |
| Avalie o mestre                      | Avalie a mestragem                                              |
| Você jogou. Avalie o mestre.         | Como foi o jogo? Avalie a mestragem.                            |
| Nota do mestre                       | Nota de mestragem                                               |
| Você é o mestre desta mesa.          | Você mestra esta mesa. / A mesa é sua.                          |
| Mestre: @bruno-leal                  | (sem artigo — já neutro)                                        |
| os jogadores confirmados             | quem tem vaga confirmada / as pessoas na mesa                   |
| Cada jogador vê a hora no fuso dele. | Cada pessoa vê a hora no próprio fuso.                          |

Casos que já existem e pedem revisão: "Jogadores e pedidos" (`manage_breadcrumb`, use "Participantes e pedidos", como a aba), "encerrada pela mestria da mesa" (`notification_player_removed`, prefira "Sua vaga em {table} foi encerrada.") e "jogadores encontram uma" no changelog de lançamento.

## Glossário

Um termo preferido por conceito. Se um termo não está aqui, siga o que `messages/pt-BR.json` já usa.

| Use                         | Evite                                | Nota                                                                 |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| mesa                        | grupo, partida, sala                 | O grupo e o jogo marcado. "Abrir uma mesa", "Mesa cheia".            |
| jogo                        | partida, aventura (como termo fixo)  | A experiência de jogar: "Como foi o jogo?".                          |
| sessão                      | encontro, rodada                     | Cada data marcada da mesa.                                           |
| campanha                    | saga, série                          | Mesa com várias sessões.                                             |
| one-shot                    | sessão única (como tipo), oneshot    | Jargão da comunidade, fica. "Sessão única" só para a recorrência.    |
| vaga                        | lugar, cadeira, assento              | "{taken} de {total} vagas". "Cadeira vazia" só no hero, como imagem. |
| pedido de vaga              | solicitação, inscrição               | Quando a mesa pede aprovação.                                        |
| aprovar / recusar / remover | aceitar, negar, rejeitar, expulsar   | Ações de quem mestra sobre pedidos e vagas.                          |
| mestre                      | narrador, GM, DM                     | Substantivo, sem artigo: "Mestre: @bruno-leal".                      |
| mestrar / quem mestra       | o mestre (com artigo), mestria       | "Você mestra esta mesa". Aba "Mestrando".                            |
| mestragem                   | a mesa, o mestre (como alvo da nota) | O que a avaliação mede.                                              |
| quem joga                   | os jogadores, players                | Também "as pessoas na mesa", "participantes".                        |
| tags                        | etiquetas, marcadores                | Fica em inglês, como a comunidade usa.                               |
| e-mail                      | email, E-mail, mail                  | Sempre com hífen, minúsculo no meio da frase.                        |
| notificação                 | alerta, mensagem                     | O que chega no sino.                                                 |
| aviso / comunicado          | notícia, alerta                      | Mensagens da administração ou da moderação para todo mundo.          |
| administração               | admin, admins, equipe                | Em frases: "só a administração vê". "Admin" só no rótulo do menu.    |
| código aberto               | open source                          | "um projeto de código aberto".                                       |

## Regras de forma

- **Números em algarismos**: "3 vagas", "a cada 2 semanas", "até 2 MB".
- **Datas e horas** vêm formatadas pelo app, no fuso de quem lê. Não escreva data à mão numa string; use um placeholder.
- **Sem ponto de exclamação**, em lugar nenhum.
- **Toasts** são uma frase curta no passado, com ponto final: "Mesa salva.", "Pedido recusado.", "Você saiu da mesa." Se houver próximo passo, vira uma segunda frase curta.
- **Botões** começam com verbo: "Salvar perfil", "Cancelar pedido", "Ver todas as mesas".
- **Contagens** ao lado de um rótulo usam ponto médio: "Jogando · 3", "Pedidos de vaga · 2". Com frase, use as chaves `_one` e plural já existentes ("1 vaga", "{count} vagas").
- **Placeholders** (`{name}`, `{table}`, `{count}`) ficam exatamente como estão: mesmo nome, mesmas chaves. Um teste falha se mudarem.
- **Reticências** com o caractere "…" em estados de carregamento: "Carregando…".
- **Aspas** curvas “assim” quando citar um nome digitado pela pessoa.
- **Nenhum texto fixo em `.svelte`**. Todo texto de interface mora em `messages/pt-BR.json`. Nomes próprios (Mesa Aberta, GitHub, Discord) também seguem como estão.

## Erros

Formato: o que houve + o que fazer. Duas frases curtas no máximo.

- "Esse CEP não existe. Confira os números ou deixe em branco."
- "A mesa lotou. Você pode tentar de novo se abrir uma vaga."
- "Não foi possível salvar agora. Tente de novo em instantes."

Sem códigos técnicos, sem "Erro:" no começo e sem "Ops".

## Changelog

Escrito para quem joga e quem mestra, sobre o que mudou **para essas pessoas**, não sobre o código.

- A primeira frase se sustenta sozinha: ela vira a notificação no sino.
- Itens começam pelo efeito: "Filtro por sistema na lista de mesas.", não "Refatoração do componente de filtro."
- Mesmas regras de neutralidade e glossário do resto do app.

| Evite                                        | Prefira                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| Mestres abrem mesas, jogadores pegam a vaga. | Mestres abrem mesas de RPG, quem joga pega a vaga.     |
| Corrigido bug no cálculo de timezone do ICS. | O convite de calendário agora usa o fuso de quem joga. |
