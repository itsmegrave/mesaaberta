# Plano do card #152: componentes, formulários e consistência visual

Card: https://trello.com/c/Hh49RShb

## Objetivo e levantamento

Migrar Superforms para TanStack Form, integrar as submissões com TanStack Query e revisar os componentes e estilos de toda a plataforma. O levantamento inicial encontrou 84 arquivos Svelte e 37 arquivos de produção que importam Superforms, além dos testes e harnesses. A revisão visual precisa cobrir telas e estados; a varredura estática inicial não conclui essa auditoria.

Hoje, Superforms participa de estado do formulário, validação client/server, valores iniciais, erros por campo, uploads, mensagens, estados de envio e proteção contra saída com alterações não salvas. TanStack Query já possui cache por usuário/recurso, transporte de leitura e invalidação por domínio em `src/lib/query/`. Esses comportamentos precisam ser preservados durante a troca.

## Arquitetura pretendida

- Skeleton e wrappers do projeto fornecem os controles e sua apresentação; TanStack Form mantém valores, validação e estado dos campos; TanStack Query mantém leituras, mutações e atualização do cache.
- Incluir explicitamente todas as ocorrências de `button`, `input`, `textarea`, `select`, `form` e `table` no inventário. Migrar o markup repetido nas telas para componentes compartilhados: botões, campos e um wrapper de formulário integrado a TanStack Form/Query. Reaproveitar `SubmitButton` e `FormField` quando apropriado. Esses wrappers centralizam variantes, tamanhos, labels, erros, foco e estado disabled/pending; não criar uma camada genérica que replique toda a API das bibliotecas.
- Usar os primitives Skeleton disponíveis para controles compostos e seus triggers/inputs: `Combobox`, `DatePicker`, `FileUpload`, `Slider`, `Switch`, `SegmentedControl`, `RatingGroup`, `Dialog` e outros conforme o caso. Verificar se escolhas de radio e avaliações atuais podem usar `SegmentedControl`/`RatingGroup`, preservando semântica e teclado. A instalação Skeleton 5.0.1 não exporta componentes independentes de Button, TextInput ou Form: os wrappers desses casos usam elementos HTML semânticos internamente, estilizados com os tokens e classes Skeleton.
- TanStack Form organiza campos e validação, enquanto o wrapper renderiza o elemento `<form>` necessário ao navegador. TanStack Table fornece modelo e comportamento de tabelas de dados; seus wrappers continuam renderizando HTML acessível. Não usar Table como componente de formulário.
- Manter os schemas Zod existentes e a validação autoritativa no servidor. Criar uma pequena camada comum para defaults, leitura de FormData, erros por caminho e mensagens de negócio, substituindo os helpers de Superforms. Tratar explicitamente arrays, números, booleans, campos opcionais e arquivos.
- Manter as actions SvelteKit e os serviços de domínio. Com JavaScript, uma mutation envia FormData à action e interpreta o ActionResult, incluindo falhas, erros e redirects; sem JavaScript, o formulário continua usando POST nativo. Um submit tem um único caminho de envio, evitando disputa entre enhancement e mutation.
- Reutilizar `afterWrite` e ampliar o mapa de invalidação para os domínios necessários. Invalidar somente após sucesso confirmado; atualizar dados antes de navegar quando necessário. Preservar o isolamento de cache por usuário e a limpeza de sessão.
- Dados de query inicializam o formulário, mas refetches não sobrescrevem campos alterados. Reset após sucesso é explícito por fluxo. Arquivos e senhas não retornam no payload de erro.
- Preservar erros traduzidos, foco/aria, bloqueio de envio duplicado, indicadores de demora, guard de saída e fallback sem JavaScript. Escritas não recebem retry automático; chat mantém retry explícito.

## Etapas e entregas

1. **Inventário e padrões de UI.** Listar as rotas, componentes, formulários, actions, dependências e comportamentos especiais. Definir padrões reutilizáveis para gutters de página, seções, cards, campos, controles, bordas, raios e foco usando a escala e tokens existentes. Registrar exceções justificadas. Atualizar a regra para TanStack Form como destino, com Superforms permitido somente durante a transição.

2. **Base compartilhada e piloto.** Adicionar uma versão de `@tanstack/svelte-form` compatível com Svelte 5 e verificar integração com o Query instalado. Implementar o contrato client/server, transporte de action por mutation, normalização de erros, estado de envio e bindings mínimos para os wrappers existentes. Migrar `admin/CatalogDialog.svelte` e suas actions como piloto: cobre validação, erros de negócio, CRUD, diálogo Skeleton e atualização de dados. Só ampliar depois de demonstrar envio único, fallback POST, falha preservando valores e atualização do cache.

3. **Formulários simples e ações.** Migrar notificações administrativas, aprovação do catálogo/fila, `ActionForm`, `NotificationAction`, inscrições e avaliação de mesa. Revisar com cada domínio as queries afetadas e os estados de sucesso/erro. GET filters continuam representados na URL; substituir a dependência de Superforms no parser por Zod e leitura explícita de parâmetros.

4. **Perfil e mesas.** Migrar onboarding, `ProfileForm`, configurações de mensagens, foto, exclusão de conta, `TableForm` e criação/edição de mesa. Preservar listas dinâmicas de redes, disponibilidade de username, CEP, datas/timezones, recorrência, preview, catálogo, recorte/upload/remoção de imagens e guard de alterações não salvas. Atualizar os helpers server de perfil e mesas sem duplicar serviços ou regras de autorização.

5. **Autenticação e chat.** Migrar `CredentialsForm`, login, cadastro, recuperação/reset de senha, `Composer` e mute de conversa. Verificar redirects e sessão, ausência de senhas em respostas, rate limits e fluxos de autenticação. No chat, preservar bolha pendente, retry explícito, texto digitado durante envio, IME/teclado e reconciliação com o polling sem duplicar mensagens.

6. **Auditoria visual completa e remoção final.** Revisar cada rota/componente e seus estados em mobile e desktop, agrupando correções por domínio. Substituir controles customizados por equivalentes Skeleton disponíveis; usar TanStack Table em tabelas com comportamento interativo, mantendo HTML semântico quando apropriado. Normalizar paddings, gaps, bordas, raios, cores e foco sem alterar valores válidos apenas por preferência. Remover Superforms, adapters, proxies, tipos e harnesses remanescentes; atualizar lockfile, README, CONTRIBUTING, CLAUDE, AGENTS e a documentação de Query.

## Organização da implementação

Implementar em branch/worktree isolado das alterações locais em andamento. Usar commits por etapa/domínio; permitir coexistência temporária das bibliotecas enquanto os fluxos migram. Cada lote deve incluir UI, action/contrato server e testes necessários. A remoção da dependência acontece somente após migrar todos os consumidores. PRs incrementais podem manter o card aberto até o término da auditoria e da remoção.

## Validação e critérios de conclusão

- Testes de contrato: conversão de FormData, campos repetidos/arrays, arquivos, erros por caminho, traduções, defaults, exclusão de senhas/arquivos da resposta, redirects e falhas de transporte.
- Testes de comportamento por domínio: validação no servidor, autorização, estado de envio, prevenção de submissão duplicada, preservação de valores/drafts, reset, guard de saída, atualização das queries e cache isolado por sessão.
- E2E dos fluxos críticos: autenticação, onboarding/perfil, criação/edição/upload de mesa, inscrição/avaliação, catálogo/notificações e envio/retry de chat; verificar os fallbacks POST relevantes sem JavaScript.
- Revisão visual de mobile/desktop em ambos os temas, incluindo estados vazios, erro, carregamento, campos inválidos, diálogos e foco de teclado. Manter uma matriz de cobertura das rotas.
- Cada ocorrência inventariada de botão, campo, formulário e tabela está migrada para o primitive/wrapper apropriado ou tem uma exceção justificada. Markup HTML repetido para controles básicos fica concentrado nos componentes compartilhados, com campos hidden e fallbacks tratados conforme necessário.
- Executar lint, typecheck e testes apropriados a cada lote; ao final executar os checks exigidos pelo projeto e build em ambiente com configuração adequada. Não executar um build que migre banco de produção como simples verificação local.
- Concluir quando não houver imports/dependência de Superforms, os formulários usarem o padrão comum Form/Query, todos os componentes estiverem auditados e valores visuais fora dos padrões tiverem sido corrigidos ou justificados.

## Referências oficiais

- TanStack Form Svelte, validação: https://tanstack.com/form/latest/docs/framework/svelte/guides/validation
- TanStack Form com dados de TanStack Query: https://tanstack.com/form/latest/docs/framework/svelte/guides/async-initial-values

A integração SvelteKit das actions, o fallback sem JavaScript e a proteção de drafts serão validados no piloto; não pressupor que a troca de biblioteca forneça automaticamente esses comportamentos.


## Entrega final

A branch final remove todos os imports e a dependência de Superforms. Auth, perfil, mesas, ações de participação/avaliação, anúncios e chat usam o contrato comum Form/Query. Os wrappers básicos substituem markup repetido; o inventário gerado descreve as exceções necessárias para POST nativo e estrutura documental. Os enums de status compartilhados alimentam banco, filtros e apresentação do admin.

A validação da PR final é executada no CI, conforme instrução do usuário: lint, tipos, unitários/componentes, integração PostgreSQL, build e E2E em dois shards. A matriz abaixo descreve a cobertura executada, sem equiparar screenshots automáticos a uma inspeção visual humana.

| Área | Cobertura e estados |
| --- | --- |
| Layout, landing, mesas públicas, tema | home, landing, tables, theme, icons, security; mobile/desktop, claro/escuro, viewport estreito, SVG/CSP, foco e navegação |
| Autenticação | auth-flows, login, rate-limit; campos inválidos, senha, redirects, confirmação/reset, sessão e ausência de segredos nas respostas |
| Perfil e onboarding | profile, onboarding, public-profile; listas de links, erro por linha, username, crop/upload, POST sem JavaScript, canonical `/u/username`, breadcrumbs em ambos os tamanhos |
| Criação e edição de mesa | tables-manage, manage-tables, forms, modality; data/fuso, arrays, imagem/remoção, guard, rascunhos, preview, sucesso/falha e POST nativo |
| Participação e avaliação | tables-play, manage-table; permissão, lotação, status, cancelamento, avaliação e atualização das leituras |
| Chat | messages e Composer; IME/Enter/emoji, pendência, falha/retry explícito, texto digitado durante envio, mute, polling e identidade do cache |
| Admin | admin, admin-catalog; GET/paginação, todos os status reais, busca, falhas de negócio, diálogo, ação duplicada e aprovação sem JavaScript |
| Notificações e anúncios | notifications, notification-actions e specs administrativos; confirmação de alcance, preview, erro de destinatário, leitura por categoria e redirects |
| Páginas documentais | legal, i18n, footer, healthz, maintenance, feedback-links; estrutura semântica, links, idiomas e estado de manutenção |

Os controles alterados mantêm os tokens e valores da escala de 4px usados pelas telas, incluindo os tamanhos móveis e desktop. Os wrappers preservam as classes explícitas dos consumidores para evitar sobrescrever geometria existente. Spinner compartilhado usa `svg-spinners:tadpole` com geometria SVG incorporada e animação desativada quando há preferência por movimento reduzido.
