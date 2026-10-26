import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letter or digit of the first two words, punctuation skipped', () => {
    expect(initialsOf('Dungeons & Dragons 5.5e (2024)')).toBe('DD');
    expect(initialsOf('Tormenta 20 (T20)')).toBe('T2');
    expect(initialsOf('Vampiro: A Máscara')).toBe('VA');
    expect(initialsOf('ébano sombrio')).toBe('ÉS');
  });

  it('takes two letters of a one-word name, and never comes back empty', () => {
    expect(initialsOf('Daggerheart')).toBe('DA');
    expect(initialsOf('—')).toBe('?');
  });
});
