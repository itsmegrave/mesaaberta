import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseCatarseListing,
  parseCatarseCampaign,
  parseMeepleListing,
  parseMeepleCampaign,
} from './sources';
import { isTabletopRpg, validateCandidate } from './candidate';
const fixture = (name: string) =>
  readFileSync(`src/lib/server/crowdfunding/import/fixtures/${name}.html`, 'utf8');
const now = new Date('2026-10-08T04:00:00Z');
describe('source campaign contracts', () => {
  it('reads Catarse pagination and stable campaign IDs, dates and owner', () => {
    expect(parseCatarseListing(fixture('catarse-list'), 1).nextPage).toBe(2);
    const result = parseCatarseCampaign(
      fixture('catarse-detail'),
      'https://www.catarse.com.br/hdcrpg2e',
      now,
    );
    expect(result).toMatchObject({
      source: 'catarse',
      externalId: '574103e3-546d-11f1-b1f4-de2b8262d5d0',
      owner: '101 Games Brasil',
      startsOn: '2026-09-15',
      endsOn: '2026-11-14',
    });
  });
  it('reads Meeplestarter public listings and explicit dates rather than countdowns', () => {
    expect(parseMeepleListing(fixture('meeple-list')).urls).toContain(
      'https://mail.meeplestarter.com.br/rpg-specters',
    );
    expect(
      parseMeepleCampaign(
        fixture('meeple-detail'),
        'https://mail.meeplestarter.com.br/rpg-specters',
        now,
      ),
    ).toMatchObject({
      externalId: '409',
      name: 'Specters Ano Zero',
      owner: 'Odyssey Publicações',
      startsOn: '2026-09-08',
      endsOn: '2026-11-08',
    });
  });
  it('rejects block pages and changed schemas instead of reporting an empty success', () => {
    expect(() => parseMeepleListing('<h1>Sorry, you have been blocked</h1>')).toThrow();
    expect(() => parseCatarseListing('<html>new layout</html>', 1)).toThrow();
  });
  it('skips campaigns without actual dates and ended campaigns', () => {
    expect(
      parseMeepleCampaign(
        fixture('meeple-detail').replace('08/11/2026', ''),
        'https://mail.meeplestarter.com.br/rpg-specters',
        now,
      ),
    ).toBeNull();
    expect(
      parseMeepleCampaign(
        fixture('meeple-detail'),
        'https://mail.meeplestarter.com.br/rpg-specters',
        new Date('2027-01-01'),
      ),
    ).toBeNull();
  });
  it('requires tabletop evidence and excludes videogames and standalone board games', () => {
    expect(isTabletopRpg('Um jogo de RPG de mesa sobre espíritos')).toBe(true);
    expect(isTabletopRpg('Um videogame RPG para PC')).toBe(false);
    expect(isTabletopRpg('Jogo de tabuleiro inspirado em RPG')).toBe(false);
    expect(isTabletopRpg('RPG de ação em mundo aberto')).toBe(false);
  });
  it('validates real dates, field limits and exact source hosts', () => {
    const result = parseMeepleCampaign(
      fixture('meeple-detail'),
      'https://mail.meeplestarter.com.br/rpg-specters',
      now,
    )!;
    expect(validateCandidate({ ...result, startsOn: '2026-02-30' }, now)).toBeNull();
    expect(validateCandidate({ ...result, owner: 'x'.repeat(81) }, now)).toBeNull();
    expect(
      validateCandidate({ ...result, url: 'https://meeplestarter.com.br.evil.test/project' }, now),
    ).toBeNull();
  });
});
it('uses the campaign narrative when the heading alone is ambiguous', () => {
  const html =
    fixture('meeple-detail').replace(
      /<h2[^>]*>[\s\S]*?<\/h2>/i,
      '<h2>Uma aventura continua!</h2>',
    ) +
    '<div class="content-main"><figure><div>Ilustração</div></figure><p>Um RPG de mesa para famílias.</p></div>';
  expect(
    parseMeepleCampaign(html, 'https://mail.meeplestarter.com.br/rpg-specters', now),
  ).not.toBeNull();
});

it('rejects card games and incidental author/hobby references to tabletop RPG', () => {
  expect(isTabletopRpg('Um jogo de cartas inspirado em RPG de mesa.')).toBe(false);
  expect(isTabletopRpg('Um livro de culinária. O autor joga RPG de mesa nos fins de semana.')).toBe(
    false,
  );
  expect(isTabletopRpg('Um livro de fantasia inspirado nas aventuras de RPG do autor.')).toBe(
    false,
  );
  expect(isTabletopRpg('O autor gosta de RPG de mesa. Sua autobiografia chega agora.')).toBe(false);
});
it('fails when Meeplestarter changed campaign markup instead of returning an empty scan', () => {
  expect(() =>
    parseMeepleListing(fixture('meeple-list').replaceAll('projeto-titulo', 'project-title')),
  ).toThrow('source_schema');
});

it('rejects non-RPG funded products through the complete Catarse parser', () => {
  for (const description of [
    'Um jogo eletrônico para Windows com um sistema de RPG de ação em mundo aberto.',
    'Um jogo de cartas inspirado em RPG de mesa.',
    'Livro de receitas. Sou autor de RPG de mesa e agora publico meu primeiro livro de culinária.',
  ]) {
    const campaign = {
      id: 'unrelated-product',
      slug: 'unrelated',
      title: 'Outro produto',
      summary: description,
      status: 'Launch',
      fundingType: 'Flex',
      startDate: '2026-10-01T03:00:00Z',
      endDate: '2026-11-01T03:00:00Z',
      user: { publicName: 'Editora' },
    };
    const html =
      '<script>self.__next_f.push(' +
      JSON.stringify([1, '1:' + JSON.stringify({ campaign }) + '\n']) +
      ')</script>';
    expect(parseCatarseCampaign(html, 'https://www.catarse.com.br/unrelated', now)).toBeNull();
  }
});
