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
`;
mkdirSync('docs', { recursive: true });
writeFileSync(out, await format(report, { ...(await resolveConfig(out)), filepath: out }));
console.log(
  `UI: ${components.length} components, ${consumers.length} Superforms consumers → ${out}`,
);
