# Inventário de migração de UI — card #152

Gerado por `node scripts/ui-inventory.ts`. Execute novamente depois de cada lote.
O parser Svelte conta elementos reais, incluindo campos hidden e fallbacks; não conta comentários ou strings em scripts. Harnesses e specs ficam fora do inventário de produção. As linhas identificam cada ocorrência para revisão, sem declarar sua migração ou auditoria concluída.

## Componentes e controles

103 arquivos Svelte de produção. Totais: button: 1; input: 47; textarea: 1; select: 1; form: 1; table: 4.

| Arquivo                                           | button | input | textarea | select | form | table | Ocorrências (tag:linha)                               |
| ------------------------------------------------- | -----: | ----: | -------: | -----: | ---: | ----: | ----------------------------------------------------- |
| src/lib/components/AccountMenu.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ActionForm.svelte              |      0 |     2 |        0 |      0 |    0 |     0 | input:62, input:63                                    |
| src/lib/components/AdminProfilesTable.svelte      |      0 |     0 |        0 |      0 |    0 |     1 | table:136                                             |
| src/lib/components/AdminTablesTable.svelte        |      0 |     1 |        0 |      0 |    0 |     1 | table:147, input:205                                  |
| src/lib/components/AuthShell.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Avatar.svelte                  |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/BottomTabBar.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Breadcrumbs.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Button.svelte                  |      1 |     0 |        0 |      0 |    0 |     0 | button:33                                             |
| src/lib/components/CepLookup.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ChatDrawer.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ChatHeader.svelte              |      0 |     1 |        0 |      0 |    0 |     0 | input:100                                             |
| src/lib/components/ChatThread.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Composer.svelte                |      0 |     1 |        0 |      0 |    0 |     0 | input:139                                             |
| src/lib/components/ConfirmAction.svelte           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/CredentialsForm.svelte         |      0 |     1 |        0 |      0 |    0 |     0 | input:32                                              |
| src/lib/components/DateTimeField.svelte           |      0 |     3 |        0 |      0 |    0 |     0 | input:123, input:203, input:209                       |
| src/lib/components/EmojiPicker.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Form.svelte                    |      0 |     0 |        0 |      0 |    1 |     0 | form:12                                               |
| src/lib/components/FormBanner.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/FormField.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Icon.svelte                    |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ImageCropper.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ImageUpload.svelte             |      0 |     3 |        0 |      0 |    0 |     0 | input:70, input:82, input:161                         |
| src/lib/components/InboxList.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/LegalConsent.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/LegalPage.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ListSkeleton.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/MessageBubble.svelte           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/MessageList.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/NotificationAction.svelte      |      0 |     2 |        0 |      0 |    0 |     0 | input:40, input:41                                    |
| src/lib/components/NotificationBell.svelte        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/NotificationIcon.svelte        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/PlayingCard.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ProfileForm.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Prose.svelte                   |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ProviderButtons.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ProviderLogo.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/QueryStatus.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/ReportDialog.svelte            |      0 |     2 |        0 |      0 |    0 |     0 | input:89, input:90                                    |
| src/lib/components/RichText.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/RichTextField.svelte           |      0 |     1 |        0 |      0 |    0 |     0 | input:299                                             |
| src/lib/components/RunningCard.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/SearchSelect.svelte            |      0 |     1 |        0 |      0 |    0 |     0 | input:224                                             |
| src/lib/components/SeatDots.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/SeatRing.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/SeatSlider.svelte              |      0 |     1 |        0 |      0 |    0 |     0 | input:72                                              |
| src/lib/components/SelectInput.svelte             |      0 |     0 |        0 |      1 |    0 |     0 | select:18                                             |
| src/lib/components/SessionConfirmation.svelte     |      0 |     4 |        0 |      0 |    0 |     0 | input:58, input:72, input:92, input:95                |
| src/lib/components/SideNav.svelte                 |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Spinner.svelte                 |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/SubmitButton.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/TableCard.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/TableForm.svelte               |      0 |     5 |        0 |      0 |    0 |     0 | input:259, input:290, input:305, input:372, input:481 |
| src/lib/components/TableIllustration.svelte       |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/TableLogo.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/TextArea.svelte                |      0 |     0 |        1 |      0 |    0 |     0 | textarea:11                                           |
| src/lib/components/TextInput.svelte               |      0 |     1 |        0 |      0 |    0 |     0 | input:11                                              |
| src/lib/components/ThemeToggle.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/Toaster.svelte                 |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/UnsavedChangesDialog.svelte    |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/UserLink.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/UserText.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/admin/AdminActionForm.svelte   |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/lib/components/admin/AdminReportsTable.svelte |      0 |     0 |        0 |      0 |    0 |     1 | table:92                                              |
| src/lib/components/admin/CatalogApprove.svelte    |      0 |     2 |        0 |      0 |    0 |     0 | input:27, input:28                                    |
| src/lib/components/admin/CatalogDialog.svelte     |      0 |     2 |        0 |      0 |    0 |     0 | input:175, input:176                                  |
| src/lib/components/admin/ModerationDialog.svelte  |      0 |     2 |        0 |      0 |    0 |     0 | input:120, input:133                                  |
| src/routes/+error.svelte                          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/+layout.svelte                         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/+page.svelte                           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/account/profile/+page.svelte           |      0 |     2 |        0 |      0 |    0 |     0 | input:170, input:273                                  |
| src/routes/account/tables/+page.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/+layout.svelte                   |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/+page.svelte                     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/audit/+page.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/catalog/+page.svelte             |      0 |     1 |        0 |      0 |    0 |     1 | input:80, table:115                                   |
| src/routes/admin/instagram/+page.svelte           |      0 |     1 |        0 |      0 |    0 |     0 | input:89                                              |
| src/routes/admin/notifications/+page.svelte       |      0 |     4 |        0 |      0 |    0 |     0 | input:258, input:267, input:273, input:285            |
| src/routes/admin/queue/+page.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/reports/+page.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/reports/[id]/+page.svelte        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/tables/+page.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/users/+page.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/admin/users/[id]/+page.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/forgot-password/+page.svelte           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/login/+page.svelte                     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/maintenance/+page.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/messages/+layout.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/messages/+page.svelte                  |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/messages/[id]/+page.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/notifications/+page.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/onboarding/+page.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/privacy/+page.svelte                   |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/reset-password/+page.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/signup/+page.svelte                    |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/tables/+page.svelte                    |      0 |     3 |        0 |      0 |    0 |     0 | input:137, input:176, input:211                       |
| src/routes/tables/[slug]/+page.svelte             |      0 |     1 |        0 |      0 |    0 |     0 | input:453                                             |
| src/routes/tables/[slug]/edit/+page.svelte        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/tables/[slug]/manage/+page.svelte      |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/tables/new/+page.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/terms/+page.svelte                     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |
| src/routes/u/[username]/+page.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                     |

## Consumidores de Superforms

0 arquivos de produção; incluir UI e contrato servidor no mesmo lote.

## Padrões e exceções a revisar

- Reutilizar SubmitButton e FormField; centralizar controles básicos nos wrappers compartilhados com classes Skeleton.
- Preservar primitives Skeleton para Dialog, Combobox, DatePicker, FileUpload e Slider; verificar SegmentedControl e RatingGroup antes de criar controles compostos.
- Manter formulários GET ligados à URL, campos hidden de transporte e HTML semântico dentro dos wrappers. Documentar a decisão por ocorrência durante a migração.
- Usar TanStack Table para tabelas interativas; revisar AdminProfilesTable como padrão existente.
- Usar escala de 4 px e tokens do tema para gutters, gaps, padding, bordas, raios e foco.
- Para cada arquivo acima, registrar revisão mobile/desktop, claro/escuro e estados de erro, vazio, envio e teclado. A contagem estática não substitui essa revisão.

## Migração concluída

Todos os consumidores de produção usam TanStack Form/Query com actions SvelteKit. Superforms e seus adapters/proxies foram removidos do código e do lockfile. A submissão compartilhada preserva validação Zod, erros por caminho, bloqueio de envio repetido, redirects, uploads e rascunhos durante refetch. Perfil/mesas usam o guard de saída; chat mantém retry explícito e o texto digitado durante envio.

## Exceções de HTML nativo

- Form, Button, TextInput, TextArea e SelectInput: implementação dos wrappers compartilhados; Skeleton 5 não exporta controles básicos independentes equivalentes.
- Inputs hidden: transporte de IDs, next, flags e arrays para actions e fallbacks sem JavaScript. Não são campos editáveis.
- Inputs radio/checkbox: escolhas e notas precisam continuar funcionando por POST sem JavaScript. SegmentedControl/RatingGroup dependem de interação JavaScript e seus HiddenInput não substituem a escolha nativa nesse fallback. Os controles mantêm labels, fieldsets, foco e bindings TanStack.
- Inputs file: seleção nativa do avatar, com crop aprimorado por JavaScript; ImageUpload usa FileUpload Skeleton. Arquivos só entram na requisição e são removidos das respostas.
- Inputs number/date/time: coerção nativa e fallbacks de DateTimeField; Slider/DatePicker Skeleton continuam responsáveis pela interação aprimorada. Campos repetidos de números não criam um novo contrato implícito.
- Tabelas: AdminProfilesTable e AdminTablesTable usam TanStack Table com paginação no servidor. Histórico de notificações e quadros documentais sem interação usam table semântico.
- Formulários GET: filtros e paginação pertencem à URL e à Query, sem estado de edição persistente. Não precisam de TanStack Form.

O inventário acima identifica as ocorrências restantes por arquivo/linha. A matriz de validação visual e funcional acompanha a PR final.
