import { presentationOf, type BadgePresentation } from './presentation';

export type HeldBadge = {
  badgeId: string;
  awardedAt: Date | string;
  hidden: boolean;
  backfilled: boolean;
};

export type ShownBadge = HeldBadge & { look: BadgePresentation };

/** The held badges that have artwork yet, whatever the owner chose to hide. */
export const withLook = (badges: readonly HeldBadge[]): ShownBadge[] =>
  badges.flatMap((badge) => {
    const look = presentationOf(badge.badgeId);
    return look ? [{ ...badge, look }] : [];
  });

/** What a visitor sees: not what the owner hid, and only the highest rung held of a ladder. */
export function publicBadges(badges: readonly HeldBadge[]): ShownBadge[] {
  const shown = withLook(badges).filter((badge) => !badge.hidden);
  return shown.filter(
    (badge) =>
      !badge.look.ladder ||
      !shown.some(
        (other) => other.look.ladder === badge.look.ladder && other.look.tier > badge.look.tier,
      ),
  );
}
