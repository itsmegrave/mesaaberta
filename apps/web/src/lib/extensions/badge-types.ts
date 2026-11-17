import type { IconName } from '#lib/icons/names.js';

// Kept out of `panels.ts`, which a private build replaces whole: this type stays the same there.

/** How a badge looks and reads: the public ones (`BADGE_PRESENTATION`) and an extension's. */
export type BadgePresentation = {
  icon: IconName;
  /** A short text ("100!") drawn on the medal instead of the icon. */
  mark?: string;
  /** 1 to 3 on a ladder (the higher the stronger the look); 0 for a badge with one level. */
  tier: 0 | 1 | 2 | 3;
  /** The ladder this badge is a rung of, so a visitor sees only the highest one held. */
  ladder?: string;
  /** Given by the team only: the owner sees it locked as "Concedida pela equipe". */
  manual?: boolean;
  name: () => string;
  /** What it says once earned ("Jogou 5 sessões."). */
  description: () => string;
  /** What it asks while locked ("Jogar 5 sessões."). Missing: it cannot be worked toward. */
  goal?: () => string;
  /** "14 de 25 sessões" for the progress bar. */
  progress?: (values: { current: number }) => string;
};
