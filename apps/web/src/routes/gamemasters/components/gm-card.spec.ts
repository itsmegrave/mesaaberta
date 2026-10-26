import { describe, expect, it } from 'vitest';
import { gmFacts, lastRunLabel } from './gm-card';

const now = new Date('2026-10-26T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('lastRunLabel', () => {
  it('counts days up to two months, then months', () => {
    expect(lastRunLabel(ago(0), now)).toBe('última hoje');
    expect(lastRunLabel(ago(1), now)).toBe('última ontem');
    expect(lastRunLabel(ago(12).toISOString(), now)).toBe('última há 12 dias');
    expect(lastRunLabel(ago(95), now)).toBe('última há 3 meses');
  });
});

describe('gmFacts', () => {
  it('joins what there is, and leaves out what there is not', () => {
    expect(
      gmFacts(
        { tables: 5, lastRunAt: ago(12), modalities: ['in_person', 'online'], city: 'Recife' },
        now,
      ),
    ).toBe('5 mesas mestradas · última há 12 dias · Online / Presencial · Recife');
    expect(gmFacts({ tables: 0, lastRunAt: null, modalities: [], city: null }, now)).toBe(
      'Nenhuma mesa mestrada ainda',
    );
  });
});
