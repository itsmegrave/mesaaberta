import { describe, expect, it } from 'vitest';
import { publicMetadata } from './metadata';
const origin = 'https://mesaaberta.example';
describe('public search metadata', () => {
  it('describes a place by its kind, area and description, never its street', () => {
    const result = publicMetadata(
      '/pp/taverna',
      {
        place: {
          name: 'Taverna do Dado',
          kind: 'game_cafe',
          description: 'Mesas toda sexta',
          street: 'Av. Boa Viagem, 100',
          neighbourhood: 'Boa Viagem',
          city: 'Recife',
          state: 'PE',
          imageUrl: 'https://sb.test/p.png',
        },
      },
      origin,
    );
    expect(result).toEqual({
      title: 'Taverna do Dado · Onde jogar RPG · Mesa Aberta',
      description: 'Luderia em Boa Viagem, Recife · PE. Mesas toda sexta',
      image: 'https://sb.test/p.png',
      type: 'website',
    });
    expect(publicMetadata('/places', {}, origin)?.title).toBe(
      'Onde jogar RPG presencial · Mesa Aberta',
    );
  });
  it('uses public table content without leaking member-only fields', () => {
    const result = publicMetadata(
      '/t/a-table',
      {
        table: {
          title: 'A aventura',
          description: '<p>Explore a floresta.</p>',
          system: { name: 'Fate' },
          status: 'active',
          joinDetails: 'PRIVATE',
          welcomeMessage: 'PRIVATE',
        },
      },
      origin,
    );
    expect(result?.title).toContain('A aventura');
    expect(result?.title).toContain('Fate');
    expect(result?.description).toContain('Explore a floresta.');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('<p>');
  });
  it('preserves angle brackets and literal entities in plain titles, systems and bios', () => {
    const table = publicMetadata(
      '/t/angle-brackets',
      {
        table: {
          title: 'Aventura <D&D>',
          system: { name: 'Fate &amp; friends' },
          description: '<p>Teste &lt;3 e &lt;strong&gt;literal&lt;/strong&gt;.</p>',
        },
      },
      origin,
    );
    expect(table?.title).toContain('Aventura <D&D>');
    expect(table?.title).toContain('Fate &amp; friends');
    expect(table?.description).toContain('Teste <3 e <strong>literal</strong>.');
    const profile = publicMetadata(
      '/u/ana',
      { profile: { username: 'ana', bio: 'Gosto de <D&D> &amp; RPGs. <3' } },
      origin,
    );
    expect(profile?.description).toBe('Gosto de <D&D> &amp; RPGs. <3');
  });

  it('shares branded listings, public handles and safe images', () => {
    expect(publicMetadata('/tables', {}, origin)?.title).toContain('Mesa Aberta');
    const profile = publicMetadata(
      '/u/ana',
      {
        profile: {
          username: 'ana',
          name: 'PRIVATE',
          bio: 'Gosto de histórias.',
          avatarUrl: 'javascript:alert(1)',
        },
      },
      origin,
    );
    expect(profile?.title).toContain('@ana');
    expect(profile?.description).toContain('Gosto de histórias.');
    expect(profile?.image).toBe(`${origin}/android-chrome-512x512.png`);
    expect(publicMetadata('/login', {}, origin)).toBeNull();
  });

  it('describes a system page by its name and counts', () => {
    const metadata = publicMetadata(
      '/s/tormenta-20',
      {
        system: { name: 'Tormenta 20' },
        facts: { openTables: 0, totalTables: 9, gmCount: 1 },
      },
      'https://mesaaberta.example',
    );
    expect(metadata?.title).toBe('Tormenta 20 · Sistemas de RPG · Mesa Aberta');
    expect(metadata?.description).toContain(
      'nenhuma mesa aberta, 9 mesas na Mesa Aberta, 1 pessoa mestra',
    );
  });
});
