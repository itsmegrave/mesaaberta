import { describe, expect, it } from 'vitest';
import { gmDirectoryQuery, readGmDirectoryFilters } from './directory-filters';

const read = (query: string) => readGmDirectoryFilters(new URLSearchParams(query));

describe('readGmDirectoryFilters', () => {
  it('reads every filter, and the defaults when there is none', () => {
    expect(read('')).toEqual({
      query: '',
      system: '',
      modality: '',
      open: false,
      sort: 'recent',
      page: 1,
    });
    expect(
      read('q=@Ana&system=Call-Of-Cthulhu&modality=in_person&open=1&sort=score&page=3'),
    ).toEqual({
      query: 'Ana',
      system: 'call-of-cthulhu',
      modality: 'in_person',
      open: true,
      sort: 'score',
      page: 3,
    });
  });

  it('drops what it does not know, and reads a bad page as 1', () => {
    expect(read('system=../x&modality=mars&open=yes&sort=best&page=-2')).toMatchObject({
      system: '',
      modality: '',
      open: false,
      sort: 'recent',
      page: 1,
    });
  });
});

describe('gmDirectoryQuery', () => {
  it('leaves the defaults out, so each list has one address', () => {
    expect(gmDirectoryQuery(read(''))).toBe('');
    expect(gmDirectoryQuery(read('open=1&sort=name&system=dnd'), 2)).toBe(
      '?system=dnd&open=1&sort=name&page=2',
    );
  });
});
