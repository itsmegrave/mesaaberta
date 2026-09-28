import { describe, expect, it } from 'vitest';
import { foldForSearch, matchesSearch } from './search';

describe('matchesSearch', () => {
  it('ignores case and accents on both sides', () => {
    expect(matchesSearch('Tormenta 20', 'tormenta')).toBe(true);
    expect(matchesSearch('Lobisomem: O Apocalipse', 'apocalipse')).toBe(true);
    expect(matchesSearch('Ordem Paranormal', 'ORDÉM')).toBe(true);
    expect(matchesSearch('Pássaro', 'passaro')).toBe(true);
  });

  it('matches anywhere in the name, and an empty query matches all', () => {
    expect(matchesSearch('Cosmere Roleplaying Game', 'roleplaying')).toBe(true);
    expect(matchesSearch('Daggerheart', '  ')).toBe(true);
    expect(matchesSearch('Daggerheart', 'savage')).toBe(false);
  });
});

describe('foldForSearch', () => {
  it('drops the accents and the case', () => {
    expect(foldForSearch('Ação É Já')).toBe('acao e ja');
  });
});
