import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, pageOf, parseEntries, parseEntry } from './entries';

const file = (frontmatter: string, body = '') => `---\n${frontmatter}\n---\n${body}`;

describe('a changelog entry', () => {
  it('reads the date, title and summary of an entry with no sections', () => {
    const entry = parseEntry(
      'lancamento',
      file('date: 2026-09-29\ntitle: Lançamento da plataforma', '\nA Mesa Aberta está no ar.\n'),
    );

    expect(entry).toMatchObject({
      slug: 'lancamento',
      date: '2026-09-29',
      title: 'Lançamento da plataforma',
      draft: false,
      summary: '<p>A Mesa Aberta está no ar.</p>',
      sections: [],
    });
  });

  it('shows sections as Adicionado, Alterado, Corrigido whatever order they were written in', () => {
    const entry = parseEntry(
      'x',
      file(
        'date: 2026-10-01\ntitle: Busca',
        '## Corrigido\n\n- Um bug\n\n## Adicionado\n\n- Busca por sistema\n',
      ),
    );

    expect(entry.sections.map((s) => s.kind)).toEqual(['added', 'fixed']);
    expect(entry.sections[0].html).toContain('<li>Busca por sistema</li>');
  });

  it('marks a draft, so it can be kept from the public', () => {
    expect(parseEntry('x', file('date: 2026-10-01\ntitle: T\ndraft: true', 'Texto')).draft).toBe(
      true,
    );
  });

  it.each([
    ['no frontmatter', 'Só texto'],
    ['a date in another format', file('date: 29/09/2026\ntitle: T', 'Texto')],
    ['a day that does not exist', file('date: 2026-02-31\ntitle: T', 'Texto')],
    ['no title', file('date: 2026-09-29', 'Texto')],
    ['a section the page does not know', file('date: 2026-09-29\ntitle: T', '## Novo\n\n- a')],
    [
      'the same section twice',
      file('date: 2026-09-29\ntitle: T', '## Adicionado\n\n- a\n\n## Adicionado\n\n- b'),
    ],
    ['an empty section', file('date: 2026-09-29\ntitle: T', '## Corrigido\n')],
    ['nothing to say', file('date: 2026-09-29\ntitle: T')],
  ])('refuses an entry with %s, naming its file', (_, raw) => {
    expect(() => parseEntry('ruim', raw)).toThrow('changelog/ruim.md');
  });
});

describe('the list of entries', () => {
  it('puts the newest first, whatever the file order', () => {
    const entries = parseEntries({
      '/src/content/changelog/2026-09-29-lancamento.md': file('date: 2026-09-29\ntitle: A', 'a'),
      '/src/content/changelog/2026-10-05-busca.md': file('date: 2026-10-05\ntitle: B', 'b'),
      '/src/content/changelog/2026-10-01-perfil.md': file('date: 2026-10-01\ntitle: C', 'c'),
    });

    expect(entries.map((e) => e.slug)).toEqual([
      '2026-10-05-busca',
      '2026-10-01-perfil',
      '2026-09-29-lancamento',
    ]);
  });
});

describe('the changelog pages', () => {
  it('carries between 10 and 20 entries per page', () => {
    expect(PAGE_SIZE).toBeGreaterThanOrEqual(10);
    expect(PAGE_SIZE).toBeLessThanOrEqual(20);
  });

  it.each([null, '', 'abc', '0', '-2', '1.5'])('reads %j as the first page', (param) => {
    expect(pageOf(param, 40, 15)).toEqual({ page: 1, pages: 3, start: 0, end: 15 });
  });

  it('slices a later page', () => {
    expect(pageOf('3', 40, 15)).toEqual({ page: 3, pages: 3, start: 30, end: 45 });
  });

  it('has no page past the last', () => {
    expect(pageOf('4', 40, 15)).toBeNull();
  });

  it('still has a first page when there are no entries', () => {
    expect(pageOf(null, 0, 15)).toEqual({ page: 1, pages: 1, start: 0, end: 15 });
  });
});
