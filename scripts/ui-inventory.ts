// Parse Svelte instead of matching markup: comments and script strings are not controls.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import { format, resolveConfig } from 'prettier';

const tags = ['button', 'input', 'textarea', 'select', 'form', 'table'];
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
const paths = files('src').sort();
const isFixture = (path: string) => /(?:Harness|\.spec\.|\/testing\/)/.test(path);
const components = paths.filter((path) => path.endsWith('.svelte') && !isFixture(path));
const totals = Object.fromEntries(tags.map((tag) => [tag, 0]));
const rows: string[] = [];
for (const path of components) {
  const source = readFileSync(path, 'utf8');
  const counts = Object.fromEntries(tags.map((tag) => [tag, 0]));
  const locations: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.type === 'RegularElement' && tags.includes(node.name as string)) {
      const tag = node.name as string;
      counts[tag]++;
      totals[tag]++;
      const line = source.slice(0, node.start as number).split('\n').length;
      locations.push(`${tag}:${line}`);
    }
    Object.values(node).forEach(visit);
  };
  visit(parse(source, { modern: true }));
  rows.push(
    `| ${path} | ${tags.map((tag) => counts[tag]).join(' | ')} | ${locations.join(', ') || '—'} |`,
  );
}
const consumers = paths.filter(
  (path) =>
    /\.(?:ts|svelte)$/.test(path) &&
    !isFixture(path) &&
    /from\s+['"]sveltekit-superforms(?:\/[^'"]*)?['"]/.test(readFileSync(path, 'utf8')),
);
const out = 'docs/ui-migration-inventory.md';
const report = `# Inventário de migração de UI — card #152

Gerado por \`node scripts/ui-inventory.ts\`. Execute novamente depois de cada lote.
O parser Svelte conta elementos reais, incluindo campos hidden e fallbacks; não conta comentários ou strings em scripts. Harnesses e specs ficam fora do inventário de produção. As linhas identificam cada ocorrência para revisão, sem declarar sua migração ou auditoria concluída.

## Componentes e controles

${components.length} arquivos Svelte de produção. Totais: ${tags.map((tag) => `${tag}: ${totals[tag]}`).join('; ')}.

| Arquivo | ${tags.join(' | ')} | Ocorrências (tag:linha) |
| --- | ${tags.map(() => '---:').join(' | ')} | --- |
${rows.join('\n')}

## Consumidores de Superforms

${consumers.length} arquivos de produção; incluir UI e contrato servidor no mesmo lote.

${consumers.map((path) => `- \`${path}\``).join('\n')}

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
`;
mkdirSync('docs', { recursive: true });
writeFileSync(out, await format(report, { ...(await resolveConfig(out)), filepath: out }));
console.log(
  `UI: ${components.length} components, ${consumers.length} Superforms consumers → ${out}`,
);
