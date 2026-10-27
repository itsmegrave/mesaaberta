import { describe, expect, it } from 'vitest';
import type { Extension } from '../extensions/contract';
import { BADGES, type BadgeDefinition } from './catalog';
import { ruleBadges } from './rules';

const badge = (id: string): BadgeDefinition => ({
  id,
  triggers: [],
  goal: 1,
  measure: async () => 0,
});
const ext = (id: string, badges?: BadgeDefinition[]): Extension => ({ id, badges });

describe('ruleBadges', () => {
  it('is the catalog when no extension brings a badge', () => {
    expect(ruleBadges([ext('a')])).toBe(BADGES);
  });

  it("adds the extensions' badges after the catalog's", () => {
    const rules = ruleBadges([ext('a', [badge('supporter')]), ext('b', [badge('patron')])]);
    expect(rules.slice(0, BADGES.length)).toEqual(BADGES);
    expect(rules.slice(BADGES.length).map((rule) => rule.id)).toEqual(['supporter', 'patron']);
  });

  it.each(['first-table', 'pioneer', 'community-helper'])('refuses the public id %s', (id) => {
    expect(() => ruleBadges([ext('a', [badge(id)])])).toThrow(/already taken/);
  });

  it('refuses an id two extensions both bring', () => {
    expect(() =>
      ruleBadges([ext('a', [badge('supporter')]), ext('b', [badge('supporter')])]),
    ).toThrow(/already taken/);
  });
});
