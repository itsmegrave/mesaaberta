import { describe, expect, it } from 'vitest';
import { publicBadges, withLook } from './shown';

const held = (badgeId: string, hidden = false) => ({
  badgeId,
  awardedAt: new Date('2026-10-01T00:00:00Z'),
  hidden,
  backfilled: false,
});

describe('publicBadges', () => {
  it('drops what is hidden, what has no artwork, and the lower rungs of a ladder', () => {
    const shown = publicBadges([
      held('gm-master-1'),
      held('gm-master-2'),
      held('partner', true),
      held('not-a-badge'),
      held('first-table'),
    ]).map((badge) => badge.badgeId);

    expect(shown).toEqual(['gm-master-2', 'first-table']);
  });

  it('keeps a lower rung when the higher one is hidden', () => {
    expect(
      publicBadges([held('gm-master-1'), held('gm-master-2', true)]).map((b) => b.badgeId),
    ).toEqual(['gm-master-1']);
  });
});

describe('withLook', () => {
  it('keeps the hidden ones, for the owner', () => {
    expect(withLook([held('partner', true), held('nope')]).map((b) => b.badgeId)).toEqual([
      'partner',
    ]);
  });
});
