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
