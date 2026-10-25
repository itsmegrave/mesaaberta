import { describe, expect, it } from 'vitest';
import { PROFILE_DEFAULTS, type ProfileInput } from '@mesaaberta/core/profile/schema';
import { withStoredFields } from './sections';

const stored: ProfileInput = {
  ...PROFILE_DEFAULTS,
  username: 'mestre-ana',
  name: 'Ana',
  bio: 'Horror cósmico.',
  city: 'Recife',
  gender: 'other',
  genderOther: 'Do meu jeito',
  timezone: 'America/Recife',
  linkNetwork: ['instagram', 'website'],
  linkUrl: ['ana', 'https://example.com'],
};

describe('withStoredFields', () => {
  it("keeps what a section sent and fills every other field from what's stored", () => {
    const sent = new FormData();
    sent.set('name', 'Ana Paula');
    sent.set('bio', '');
    sent.set('city', 'Olinda');
    sent.set('username', 'someone-else');
    const data = withStoredFields(sent, stored, 'public');
    expect(data.get('name')).toBe('Ana Paula');
    expect(data.get('bio')).toBe('');
    expect(data.get('city')).toBe('Recife');
    expect(data.get('username')).toBe('mestre-ana');
    expect(data.get('genderOther')).toBe('Do meu jeito');
    // Links belong to this section: none sent means all of them were removed.
    expect(data.getAll('linkNetwork')).toEqual([]);
    expect(data.getAll('linkUrl')).toEqual([]);
  });

  it('keeps the stored links in order when another section saves', () => {
    const sent = new FormData();
    sent.set('city', 'Olinda');
    sent.append('linkNetwork', 'x');
    const data = withStoredFields(sent, stored, 'about');
    expect(data.get('city')).toBe('Olinda');
    expect(data.get('name')).toBe('Ana');
    expect(data.get('bio')).toBe('Horror cósmico.');
    expect(data.getAll('linkNetwork')).toEqual(['instagram', 'website']);
    expect(data.getAll('linkUrl')).toEqual(['ana', 'https://example.com']);
  });
});
