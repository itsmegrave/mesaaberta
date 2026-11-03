import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether a table's safety tools and content rating are on for this person (`use_table_safety`), or
 * for visitors when there is none: the form fields, the table page section and the list's 18+ rule.
 */
export async function tableSafetyEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  return locals.flags.isEnabled(
    'use_table_safety',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/**
 * Whether the content rating is drawn as its ClassInd symbol on cards and the table page
 * (`use_content_rating_symbol`, only with `use_table_safety`). Off, cards carry no rating and the
 * page keeps its "14+" chip.
 */
export async function contentRatingSymbolShown(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  if (!(await tableSafetyEnabled(locals, profile))) return false;
  return locals.flags.isEnabled(
    'use_content_rating_symbol',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/** A card's rating as the card should draw it: none unless the symbol is on. */
export const cardRating =
  (shown: boolean) =>
  <T extends { contentRating?: string | null }>(
    table: T,
  ): T & { contentRating: string | null } => ({
    ...table,
    contentRating: shown ? (table.contentRating ?? null) : null,
  });
