import { describe, expect, it } from 'vitest';
import { publicMetadata } from './metadata';
const origin = 'https://mesaaberta.example';
describe('public search metadata', () => {
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
    expect(publicMetadata('/t', {}, origin)?.title).toContain('Mesa Aberta');
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
});
