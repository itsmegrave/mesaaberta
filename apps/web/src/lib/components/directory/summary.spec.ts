import { describe, expect, it } from 'vitest';
import { namesSummary } from './summary';

describe('namesSummary', () => {
  it('names up to two and counts the rest', () => {
    expect(namesSummary([])).toBe('');
    expect(namesSummary(['Acessível'])).toBe('Acessível');
    expect(namesSummary(['Acessível', 'Empresta jogos'])).toBe('Acessível, Empresta jogos');
    expect(namesSummary(['Acessível', 'Empresta jogos', 'Wi-fi'])).toBe(
      'Acessível, Empresta jogos e mais 1',
    );
  });

  it('counts what the section holds beyond the names given', () => {
    expect(namesSummary(['@ana', '@bia'], 5)).toBe('@ana, @bia e mais 3');
  });
});
