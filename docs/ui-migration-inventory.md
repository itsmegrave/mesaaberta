# Inventário de migração de UI — card #152

Gerado por `node scripts/ui-inventory.ts`. Execute novamente depois de cada lote.
O parser Svelte conta elementos reais, incluindo campos hidden e fallbacks; não conta comentários ou strings em scripts. Harnesses e specs ficam fora do inventário de produção. As linhas identificam cada ocorrência para revisão, sem declarar sua migração ou auditoria concluída.

## Componentes e controles

82 arquivos Svelte de produção. Totais: button: 35; input: 57; textarea: 7; select: 8; form: 22; table: 2.

| Arquivo                                        | button | input | textarea | select | form | table | Ocorrências (tag:linha)                                                                                                                                              |
| ---------------------------------------------- | -----: | ----: | -------: | -----: | ---: | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src/lib/components/AccountMenu.svelte          |      0 |     0 |        0 |      0 |    1 |     0 | form:94                                                                                                                                                              |
| src/lib/components/ActionForm.svelte           |      0 |     2 |        0 |      0 |    1 |     0 | form:71, input:72, input:73                                                                                                                                          |
| src/lib/components/AdminProfilesTable.svelte   |      3 |     1 |        0 |      2 |    1 |     1 | form:77, input:97, select:107, button:113, table:126, select:167, button:181, button:189                                                                             |
| src/lib/components/AuthShell.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/Avatar.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/BottomTabBar.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/Breadcrumbs.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/CepLookup.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ChatHeader.svelte           |      0 |     0 |        0 |      0 |    1 |     0 | form:74                                                                                                                                                              |
| src/lib/components/ChatThread.svelte           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/Composer.svelte             |      0 |     1 |        1 |      0 |    1 |     0 | form:114, input:121, textarea:124                                                                                                                                    |
| src/lib/components/ConfirmAction.svelte        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/CredentialsForm.svelte      |      0 |     3 |        0 |      0 |    1 |     0 | form:29, input:32, input:39, input:57                                                                                                                                |
| src/lib/components/DateTimeField.svelte        |      0 |     3 |        0 |      0 |    0 |     0 | input:123, input:203, input:209                                                                                                                                      |
| src/lib/components/Form.svelte                 |      0 |     0 |        0 |      0 |    1 |     0 | form:11                                                                                                                                                              |
| src/lib/components/FormBanner.svelte           |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/FormField.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/Icon.svelte                 |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ImageCropper.svelte         |      4 |     0 |        0 |      0 |    0 |     0 | button:150, button:156, button:179, button:184                                                                                                                       |
| src/lib/components/ImageUpload.svelte          |      2 |     3 |        0 |      0 |    0 |     0 | button:63, input:68, button:70, input:79, input:158                                                                                                                  |
| src/lib/components/InboxList.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/LegalConsent.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/LegalPage.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ListSkeleton.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/MessageBubble.svelte        |      1 |     0 |        0 |      0 |    0 |     0 | button:51                                                                                                                                                            |
| src/lib/components/MessageList.svelte          |      1 |     0 |        0 |      0 |    0 |     0 | button:87                                                                                                                                                            |
| src/lib/components/NotificationAction.svelte   |      0 |     2 |        0 |      0 |    1 |     0 | form:33, input:39, input:40                                                                                                                                          |
| src/lib/components/NotificationBell.svelte     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/NotificationIcon.svelte     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/PlayingCard.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ProfileForm.svelte          |      4 |     5 |        0 |      3 |    1 |     0 | form:233, input:244, input:281, select:301, select:323, input:348, input:367, select:422, input:433, button:454, button:463, button:472, button:486                  |
| src/lib/components/Prose.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ProviderButtons.svelte      |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/ProviderLogo.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/QueryStatus.svelte          |      1 |     0 |        0 |      0 |    0 |     0 | button:9                                                                                                                                                             |
| src/lib/components/RunningCard.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/SearchSelect.svelte         |      1 |     1 |        0 |      1 |    0 |     0 | button:195, input:221, select:227                                                                                                                                    |
| src/lib/components/SeatDots.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/SeatRing.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/SeatSlider.svelte           |      0 |     1 |        0 |      0 |    0 |     0 | input:72                                                                                                                                                             |
| src/lib/components/SideNav.svelte              |      1 |     0 |        0 |      0 |    0 |     0 | button:196                                                                                                                                                           |
| src/lib/components/SubmitButton.svelte         |      1 |     0 |        0 |      0 |    0 |     0 | button:30                                                                                                                                                            |
| src/lib/components/TableCard.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/TableForm.svelte            |      0 |     8 |        4 |      1 |    1 |     0 | form:110, input:158, textarea:196, textarea:211, textarea:226, input:253, input:281, input:296, select:314, input:363, input:377, input:395, textarea:413, input:457 |
| src/lib/components/TableIllustration.svelte    |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/TableLogo.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/TextInput.svelte            |      0 |     1 |        0 |      0 |    0 |     0 | input:6                                                                                                                                                              |
| src/lib/components/ThemeToggle.svelte          |      1 |     0 |        0 |      0 |    0 |     0 | button:39                                                                                                                                                            |
| src/lib/components/Toaster.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/lib/components/UnsavedChangesDialog.svelte |      2 |     0 |        0 |      0 |    0 |     0 | button:32, button:37                                                                                                                                                 |
| src/lib/components/admin/CatalogApprove.svelte |      0 |     2 |        0 |      0 |    0 |     0 | input:27, input:28                                                                                                                                                   |
| src/lib/components/admin/CatalogDialog.svelte  |      0 |     2 |        0 |      1 |    0 |     0 | input:174, input:175, select:209                                                                                                                                     |
| src/routes/+error.svelte                       |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/+layout.svelte                      |      1 |     0 |        0 |      0 |    0 |     0 | button:183                                                                                                                                                           |
| src/routes/+page.svelte                        |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/account/profile/+page.svelte        |      0 |     3 |        0 |      0 |    3 |     0 | form:157, input:166, input:225, form:247, form:298, input:302                                                                                                        |
| src/routes/account/tables/+page.svelte         |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/admin/+layout.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/admin/+page.svelte                  |      1 |     0 |        0 |      0 |    0 |     0 | button:88                                                                                                                                                            |
| src/routes/admin/catalog/+page.svelte          |      4 |     2 |        0 |      0 |    1 |     1 | form:71, input:76, input:81, button:90, table:111, button:139, button:160, button:169                                                                                |
| src/routes/admin/instagram/+page.svelte        |      3 |     3 |        0 |      0 |    3 |     0 | form:56, input:57, button:58, form:74, button:75, form:86, input:92, input:94, button:102                                                                            |
| src/routes/admin/notifications/+page.svelte    |      2 |     7 |        1 |      0 |    1 |     0 | form:179, input:204, textarea:222, input:238, input:247, input:253, input:265, input:280, input:304, button:327, button:334                                          |
| src/routes/admin/queue/+page.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/admin/users/[id]/+page.svelte       |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/changelog/+page.svelte              |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/forgot-password/+page.svelte        |      0 |     1 |        0 |      0 |    1 |     0 | form:37, input:51                                                                                                                                                    |
| src/routes/login/+page.svelte                  |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/maintenance/+page.svelte            |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/messages/+layout.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/messages/+page.svelte               |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/messages/[id]/+page.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/notifications/+page.svelte          |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/onboarding/+page.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/privacy/+page.svelte                |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/reset-password/+page.svelte         |      0 |     2 |        0 |      0 |    1 |     0 | form:48, input:57, input:76                                                                                                                                          |
| src/routes/signup/+page.svelte                 |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/tables/+page.svelte                 |      1 |     3 |        0 |      0 |    1 |     0 | form:125, input:133, input:168, input:203, button:220                                                                                                                |
| src/routes/tables/[slug]/+page.svelte          |      1 |     1 |        1 |      0 |    1 |     0 | button:390, form:415, input:422, textarea:443                                                                                                                        |
| src/routes/tables/[slug]/edit/+page.svelte     |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/tables/[slug]/manage/+page.svelte   |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/tables/new/+page.svelte             |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |
| src/routes/terms/+page.svelte                  |      0 |     0 |        0 |      0 |    0 |     0 | —                                                                                                                                                                    |

## Consumidores de Superforms

32 arquivos de produção; incluir UI e contrato servidor no mesmo lote.

- `src/lib/components/ActionForm.svelte`
- `src/lib/components/ChatHeader.svelte`
- `src/lib/components/Composer.svelte`
- `src/lib/components/CredentialsForm.svelte`
- `src/lib/components/NotificationAction.svelte`
- `src/lib/components/ProfileForm.svelte`
- `src/lib/components/TableForm.svelte`
- `src/lib/forms/server.ts`
- `src/lib/server/registrations/form-action.ts`
- `src/lib/server/tables/form-action.ts`
- `src/lib/tables/filters.ts`
- `src/routes/account/profile/+page.server.ts`
- `src/routes/account/profile/+page.svelte`
- `src/routes/admin/notifications/+page.server.ts`
- `src/routes/admin/notifications/+page.svelte`
- `src/routes/forgot-password/+page.server.ts`
- `src/routes/forgot-password/+page.svelte`
- `src/routes/login/+page.server.ts`
- `src/routes/login/+page.svelte`
- `src/routes/messages/[id]/+page.server.ts`
- `src/routes/notifications/+page.server.ts`
- `src/routes/onboarding/+page.server.ts`
- `src/routes/reset-password/+page.server.ts`
- `src/routes/reset-password/+page.svelte`
- `src/routes/signup/+page.server.ts`
- `src/routes/signup/+page.svelte`
- `src/routes/tables/[slug]/+page.server.ts`
- `src/routes/tables/[slug]/+page.svelte`
- `src/routes/tables/[slug]/edit/+page.server.ts`
- `src/routes/tables/[slug]/edit/+page.svelte`
- `src/routes/tables/new/+page.server.ts`
- `src/routes/tables/new/+page.svelte`

## Padrões e exceções a revisar

- Reutilizar SubmitButton e FormField; centralizar controles básicos nos wrappers compartilhados com classes Skeleton.
- Preservar primitives Skeleton para Dialog, Combobox, DatePicker, FileUpload e Slider; verificar SegmentedControl e RatingGroup antes de criar controles compostos.
- Manter formulários GET ligados à URL, campos hidden de transporte e HTML semântico dentro dos wrappers. Documentar a decisão por ocorrência durante a migração.
- Usar TanStack Table para tabelas interativas; revisar AdminProfilesTable como padrão existente.
- Usar escala de 4 px e tokens do tema para gutters, gaps, padding, bordas, raios e foco.
- Para cada arquivo acima, registrar revisão mobile/desktop, claro/escuro e estados de erro, vazio, envio e teclado. A contagem estática não substitui essa revisão.

## Piloto implementado

CatalogDialog, CatalogApprove e suas actions usam a base compartilhada Form/Query: validação Zod, erros de negócio, submissão única, valores preservados na falha e invalidação após sucesso. Form, FormField, TextInput e SubmitButton centralizam os controles básicos do piloto. O select de mesclagem continua nativo: Skeleton não exporta Select independente; a escolha simples preserva label, teclado e valores do POST sem adicionar busca ou comportamento composto. Os campos hidden transportam kind/id. O diálogo exige JavaScript; aprovação mantém POST nativo.

Revisão visual do diálogo em 2026-09-30: mobile/desktop e claro/escuro, incluindo campo inválido, hint, erro, foco, bordas, raios, padding e botões. E2E cobre criação, correção após erro de negócio, reset após sucesso, rename/merge/reject e aprovação com/sem JavaScript. Essa cobertura é do piloto; as outras telas e estados continuam sujeitos à matriz de revisão completa.

## Próximo lote

Migrar ações simples e notificações administrativas antes de perfil/mesas e autenticação/chat. A revisão visual completa e a remoção de Superforms continuam pendentes; não marcar o card como concluído apenas por este piloto.
