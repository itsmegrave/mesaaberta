import { describe, expect, it } from 'vitest';
import type { Resolver } from '../../crowdfunding/link-preview';
import {
  findLogoInHtml,
  findSystemLogo,
  foldName,
  isRpgItem,
  pickArticle,
  pickEntity,
  searchNames,
  type WikidataEntity,
} from './finder';

const publicDns: Resolver = async () => ['93.184.216.34'];
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const html = (body: string) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });

const item = (
  id: string,
  label: string,
  {
    description = 'tabletop role-playing game',
    logo,
    website,
    aliases = [],
    enwiki,
  }: {
    description?: string;
    logo?: string;
    website?: string;
    aliases?: string[];
    enwiki?: string;
  } = {},
): WikidataEntity => ({
  id,
  ...(enwiki ? { sitelinks: { enwiki: { title: enwiki } } } : {}),
  labels: { en: { value: label } },
  aliases: { en: aliases.map((value) => ({ value })) },
  descriptions: { en: { value: description } },
  claims: {
    ...(logo ? { P154: [{ rank: 'normal', mainsnak: { datavalue: { value: logo } } }] } : {}),
    ...(website ? { P856: [{ rank: 'normal', mainsnak: { datavalue: { value: website } } }] } : {}),
  },
});

describe('searchNames', () => {
  it('searches the name, then without parentheses, then without the edition', () => {
    expect(searchNames('Dungeons & Dragons 5.5e (2024)')).toEqual([
      { term: 'Dungeons & Dragons 5.5e (2024)', exact: true },
      { term: 'Dungeons & Dragons 5.5e', exact: true },
      { term: 'Dungeons & Dragons', exact: false },
    ]);
    expect(searchNames('Daggerheart')).toEqual([{ term: 'Daggerheart', exact: true }]);
    expect(searchNames('Vampiro: A Máscara 5ª Edição').at(-1)).toEqual({
      term: 'Vampiro: A Máscara',
      exact: false,
    });
  });

  it('folds accents, case and punctuation alike', () => {
    expect(foldName('Caçador: A Revanche')).toBe('cacador a revanche');
    expect(foldName(':Otherscape')).toBe('otherscape');
  });
});

describe('pickEntity', () => {
  it('takes the role-playing game whose name matches, never a namesake', () => {
    const film = item('Q1', 'Daggerheart', { description: '2025 film' });
    const game = item('Q2', 'Daggerheart', { logo: 'Daggerheart logo.svg' });

    expect(pickEntity('Daggerheart', [film, game])).toEqual({ entity: game, exact: true });
    expect(pickEntity('Daggerheart', [film])).toBeNull();
  });

  it('matches an alias, and a name without the edition only loosely', () => {
    const dnd = item('Q3', 'Dungeons & Dragons', { aliases: ['D&D'], logo: 'DnD.svg' });

    expect(pickEntity('Dungeons & Dragons 5e (2014)', [dnd])).toEqual({
      entity: dnd,
      exact: false,
    });
    expect(pickEntity('D&D', [dnd])).toEqual({ entity: dnd, exact: true });
  });

  it('reads a Portuguese description as a role-playing game too', () => {
    expect(isRpgItem(item('Q4', 'Tormenta', { description: 'jogo de RPG brasileiro' }))).toBe(true);
    expect(isRpgItem(item('Q5', 'Tormenta', { description: 'fenômeno meteorológico' }))).toBe(
      false,
    );
  });
});

describe('pickArticle', () => {
  it('takes the article named like the system that says it is a role-playing game', () => {
    const film = { title: 'Blades in the Dark', index: 1, description: '2025 film' };
    const game = {
      title: 'Blades in the Dark (role-playing game)',
      index: 2,
      pageimage: 'Blades.jpg',
    };
    const other = { title: 'A Blade in the Dark', index: 3, description: 'tabletop RPG' };

    expect(pickArticle('Blades in the Dark', [other, game, film])).toEqual({
      page: game,
      exact: true,
    });
    expect(pickArticle('Blades in the Dark', [film, other])).toBeNull();
    expect(
      pickArticle('Tormenta 20 (T20)', [{ title: 'Tormenta 20', description: 'jogo de RPG' }])
        ?.exact,
    ).toBe(true);
  });
});

describe('findLogoInHtml', () => {
  const base = new URL('https://www.example.com/');

  it('prefers a logo that carries the system name, and makes it absolute', () => {
    const found = findLogoInHtml(
      `<img src="/img/editora-logo.png" class="logo">
       <img src="/img/daggerheart_logo.webp" alt="Daggerheart">`,
      base,
      'Daggerheart',
    );
    expect(found).toEqual({
      url: 'https://www.example.com/img/daggerheart_logo.webp',
      mentionsName: true,
    });
  });

  it('falls back to the first logo, skips SVG and pictures that are not logos', () => {
    expect(
      findLogoInHtml(
        '<img src="/hero.jpg"><img src="/logo.svg" class="logo"><img src="/brand.png" id="site-logo">',
        base,
        'Daggerheart',
      ),
    ).toEqual({ url: 'https://www.example.com/brand.png', mentionsName: false });
    expect(findLogoInHtml('<img src="/logo.svg">', base, 'X')).toEqual({ onlySvg: true });
    expect(findLogoInHtml('<img src="/hero.jpg">', base, 'X')).toBeNull();
  });
});

describe('findSystemLogo', () => {
  const routes = (table: Record<string, () => Response>) => async (input: string) => {
    const url = new URL(input);
    for (const [key, answer] of Object.entries(table)) if (input.includes(key)) return answer();
    return new Response('not here', { status: 404, headers: { 'x-url': url.href } });
  };

  it('takes the Commons logo of the matching Wikidata item, with its licence', async () => {
    const fetcher = routes({
      wbsearchentities: () => json({ search: [{ id: 'Q2' }] }),
      wbgetentities: () =>
        json({ entities: { Q2: item('Q2', 'Daggerheart', { logo: 'Daggerheart logo.svg' }) } }),
      'commons.wikimedia.org/w/api.php': () =>
        json({
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    thumburl: 'https://upload.wikimedia.org/thumb/Daggerheart_logo.svg.png',
                    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Daggerheart_logo.svg',
                    extmetadata: {
                      LicenseShortName: { value: 'Public domain' },
                      Artist: { value: '<a href="x">Darrington Press</a>' },
                    },
                  },
                ],
              },
            },
          },
        }),
    });

    const found = await findSystemLogo('Daggerheart', { fetcher, resolve: publicDns });

    expect(found).toMatchObject({
      wikidataId: 'Q2',
      reason: null,
      candidate: {
        imageUrl: 'https://upload.wikimedia.org/thumb/Daggerheart_logo.svg.png',
        sourcePage: 'https://commons.wikimedia.org/wiki/File:Daggerheart_logo.svg',
        method: 'wikidata',
        confidence: 'high',
        license: 'Public domain',
        attribution: 'Darrington Press',
      },
    });
  });

  it('finds a Commons file named after the system when the item has no logo', async () => {
    const fetcher = routes({
      wbsearchentities: () => json({ search: [{ id: 'Q7' }] }),
      wbgetentities: () => json({ entities: { Q7: item('Q7', 'Blades in the Dark') } }),
      'list=search': () =>
        json({
          query: {
            search: [
              { title: 'File:Blades in the Dark cover.jpg' },
              { title: 'File:Club Blades in the Dark Sports logo.png' },
              { title: 'File:Blades in the Dark logo.svg' },
            ],
          },
        }),
      'prop=imageinfo': () =>
        json({
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    thumburl: 'https://upload.wikimedia.org/bitd.png',
                    descriptionurl: '//commons.wikimedia.org/wiki/File:Blades_in_the_Dark_logo.svg',
                  },
                ],
              },
            },
          },
        }),
    });

    const found = await findSystemLogo('Blades in the Dark', { fetcher, resolve: publicDns });

    expect(found.candidate).toMatchObject({
      imageUrl: 'https://upload.wikimedia.org/bitd.png',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Blades_in_the_Dark_logo.svg',
      method: 'commons',
      confidence: 'medium',
    });
  });

  it('reads the official site when the item has no logo, at most at medium', async () => {
    const fetcher = routes({
      wbsearchentities: () => json({ search: [{ id: 'Q9' }] }),
      wbgetentities: () =>
        json({
          entities: { Q9: item('Q9', 'Ordem Paranormal', { website: 'https://op.example.com/' }) },
        }),
      'list=search': () => json({ query: { search: [] } }),
      'op.example.com': () => html('<img src="/ordem-paranormal-logo.png" alt="Ordem Paranormal">'),
    });

    const found = await findSystemLogo('Ordem Paranormal', { fetcher, resolve: publicDns });

    expect(found.candidate).toMatchObject({
      imageUrl: 'https://op.example.com/ordem-paranormal-logo.png',
      sourcePage: 'https://op.example.com/',
      method: 'website',
      confidence: 'medium',
    });
  });

  it('says why there is nothing', async () => {
    const nothing = await findSystemLogo('Sistema Caseiro', {
      fetcher: routes({
        wbsearchentities: () => json({ search: [] }),
        'list=search': () => json({ query: { search: [] } }),
        'wikipedia.org': () => json({}),
      }),
      resolve: publicDns,
    });
    expect(nothing).toEqual({
      candidate: null,
      wikidataId: null,
      website: null,
      reason: 'no_wikidata_item',
    });

    const down = await findSystemLogo('Daggerheart', {
      fetcher: async () => {
        throw new TypeError('network down');
      },
      resolve: publicDns,
    });
    // Not "nothing found": the search could not ask, so nothing is recorded for the system.
    expect(down.reason).toBe('lookup_failed');
    const refused = await findSystemLogo('Daggerheart', {
      fetcher: routes({ wbsearchentities: () => new Response('busy', { status: 429 }) }),
      resolve: publicDns,
    });
    expect(refused.reason).toBe('lookup_failed');
  });

  it('finds the system through Wikipedia when Wikidata does not know the name', async () => {
    const fetcher = routes({
      wbsearchentities: () => json({ search: [] }),
      wbgetentities: () => json({ entities: { Q5: item('Q5', 'Call of Cthulhu') } }),
      'list=search': () => json({ query: { search: [] } }),
      'prop=imageinfo': () =>
        json({
          query: {
            pages: {
              '1': {
                imageinfo: [
                  {
                    thumburl: 'https://upload.wikimedia.org/pt/coc.png',
                    descriptionurl: '//pt.wikipedia.org/wiki/Ficheiro:Chamado_logo.png',
                    extmetadata: { LicenseShortName: { value: 'Uso restrito' } },
                  },
                ],
              },
            },
          },
        }),
      'en.wikipedia.org': () => json({ query: { pages: {} } }),
      'pt.wikipedia.org': () =>
        json({
          query: {
            pages: {
              '9': {
                title: 'Chamado de Cthulhu',
                index: 1,
                description: 'jogo de RPG de horror',
                pageimage: 'Chamado logo.png',
                pageprops: { wikibase_item: 'Q5' },
              },
            },
          },
        }),
    });

    const found = await findSystemLogo('Chamado de Cthulhu', { fetcher, resolve: publicDns });

    expect(found).toMatchObject({
      wikidataId: 'Q5',
      reason: null,
      candidate: {
        imageUrl: 'https://upload.wikimedia.org/pt/coc.png',
        sourcePage: 'https://pt.wikipedia.org/wiki/Ficheiro:Chamado_logo.png',
        method: 'wikipedia',
        confidence: 'medium',
        license: 'Uso restrito',
      },
    });
  });

  it("takes the item's article picture, at low, when nothing else has a logo", async () => {
    const fetcher = routes({
      wbsearchentities: () => json({ search: [{ id: 'Q6' }] }),
      wbgetentities: () =>
        json({ entities: { Q6: item('Q6', '13th Age', { enwiki: '13th Age' }) } }),
      'list=search': () => json({ query: { search: [] } }),
      'prop=imageinfo': () =>
        json({
          query: {
            pages: {
              '1': { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/en/13th.jpg' }] },
            },
          },
        }),
      'en.wikipedia.org': () =>
        json({ query: { pages: { '3': { title: '13th Age', pageimage: '13th Age cover.jpg' } } } }),
    });

    const found = await findSystemLogo('13th Age', { fetcher, resolve: publicDns });

    expect(found.candidate).toMatchObject({
      imageUrl: 'https://upload.wikimedia.org/en/13th.jpg',
      sourcePage: 'https://en.wikipedia.org/wiki/File:13th_Age_cover.jpg',
      method: 'wikipedia',
      confidence: 'low',
    });
  });

  it('waits once when Wikidata asks it to slow down', async () => {
    let calls = 0;
    const found = await findSystemLogo('Sistema Caseiro', {
      fetcher: async () =>
        ++calls === 1
          ? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
          : json({ search: [], query: { search: [] } }),
      resolve: publicDns,
    });
    expect(found.reason).toBe('no_wikidata_item');
    expect(calls).toBeGreaterThan(1);
  });
});
