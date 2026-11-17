import { extensions } from '../extensions/index';
import type { Extension } from '../extensions/contract';
import { BADGES, MANUAL_BADGES, PIONEER_BADGE, type BadgeDefinition } from './catalog';

/**
 * Every badge a rule awards: the catalog's, then the extensions' (`Extension.badges`), such as a
 * supporter badge from the private package. An id the app already uses is refused, so an extension
 * cannot take over a public badge or the people who hold it.
 */
export function ruleBadges(list: readonly Extension[] = extensions): readonly BadgeDefinition[] {
  const own = list.flatMap((extension) => extension.badges ?? []);
  if (own.length === 0) return BADGES;
  const taken = new Set<string>([
    ...BADGES.map((rule) => rule.id),
    PIONEER_BADGE,
    ...MANUAL_BADGES,
  ]);
  for (const rule of own) {
    if (taken.has(rule.id)) throw new Error(`Extension badge "${rule.id}" is already taken`);
    taken.add(rule.id);
  }
  return [...BADGES, ...own];
}
