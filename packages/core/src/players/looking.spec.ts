import { describe, expect, it } from 'vitest';
import { lookingSchema, playerQuery, readPlayerFilters } from './looking';

describe('readPlayerFilters', () => {
  it('reads the filters and drops what is not one', () => {
    expect(readPlayerFilters(new URLSearchParams('q=@ana&system=D%26D&page=x&sort=name'))).toEqual({
      query: 'ana',
      system: '',
      day: '',
      period: '',
      page: 1,
    });
    expect(
      readPlayerFilters(new URLSearchParams('system=tormenta20&day=sat&period=dawn&page=2')),
    ).toEqual({
      query: '',
      system: 'tormenta20',
      day: 'sat',
      period: '',
      page: 2,
    });
  });

  it('writes one address per list, defaults left out', () => {
    expect(playerQuery({ query: '', system: '', day: '', period: '' })).toBe('');
    expect(
      playerQuery({ query: 'terror', system: 'cthulhu', day: 'fri', period: 'night' }, 3),
    ).toBe('?q=terror&system=cthulhu&day=fri&period=night&page=3');
  });
});

describe('lookingSchema', () => {
  it('squeezes the note and refuses one that is too long', () => {
    expect(lookingSchema.parse({ looking: true, note: '  a \n b ' })).toEqual({
      looking: true,
      note: 'a b',
    });
    expect(lookingSchema.safeParse({ looking: true, note: 'x'.repeat(201) }).success).toBe(false);
  });
});
