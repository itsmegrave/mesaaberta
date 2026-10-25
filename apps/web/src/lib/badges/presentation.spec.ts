import { describe, expect, it } from 'vitest';
import { BADGES } from '@mesaaberta/core/server/badges/catalog';
import { PIONEER_BADGE } from '@mesaaberta/core/server/badges/backfill';
import { BADGE_PRESENTATION, presentationOf } from './presentation';

describe('badge presentation', () => {
  it('covers every badge a rule or a backfill can give, with a name and a description', () => {
    for (const id of [...BADGES.map((badge) => badge.id), PIONEER_BADGE]) {
      const look = presentationOf(id);
      expect(look, id).not.toBeNull();
      expect(look!.name().length, id).toBeGreaterThan(0);
      expect(look!.description().length, id).toBeGreaterThan(0);
    }
  });

  it('gives the rungs of a ladder rising tiers, and no artwork for an unknown id', () => {
    for (const ladder of ['regular-player', 'gm-master']) {
      expect([1, 2, 3].map((n) => BADGE_PRESENTATION[`${ladder}-${n}`].tier)).toEqual([1, 2, 3]);
    }
    expect(presentationOf('not-a-badge')).toBeNull();
  });
});
