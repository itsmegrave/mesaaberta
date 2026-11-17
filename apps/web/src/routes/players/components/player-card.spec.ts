import { describe, expect, it } from 'vitest';
import { playerFacts } from './player-card';

const now = new Date('2026-10-29T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('playerFacts', () => {
  it('says since when they are looking and how many tables they played', () => {
    expect(playerFacts({ lookingSince: ago(0), played: 0 }, now)).toBe(
      'procurando desde hoje · nenhuma mesa jogada ainda',
    );
    expect(playerFacts({ lookingSince: ago(1).toISOString(), played: 1 }, now)).toBe(
      'procurando desde ontem · 1 mesa jogada',
    );
    expect(playerFacts({ lookingSince: ago(12), played: 7 }, now)).toBe(
      'procurando há 12 dias · 7 mesas jogadas',
    );
  });
});
