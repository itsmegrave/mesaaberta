import { m } from '#lib/paraglide/messages.js';

type Counts = { played: number; ran: number; companions: number; badges: number };

/** The big numbers of a Retrospectiva, in order; a role the person did not play is left out. */
export function reviewTiles(review: Counts) {
  return [
    review.played > 0 && {
      key: 'played',
      value: review.played,
      label: m.year_review_played({ count: review.played }),
    },
    review.ran > 0 && {
      key: 'ran',
      value: review.ran,
      label: m.year_review_ran({ count: review.ran }),
    },
    {
      key: 'companions',
      value: review.companions,
      label: m.year_review_companions({ count: review.companions }),
    },
    {
      key: 'badges',
      value: review.badges,
      label: m.year_review_badges_tile({ count: review.badges }),
    },
  ].filter((tile) => tile !== false);
}
