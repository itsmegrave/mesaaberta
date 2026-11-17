/**
 * What an admin said about an event that was given up on: looked at it (`seen`), leaves it as it
 * is (`ignored`, which "run all the failed ones" then skips) or fixed its cause (`fixed`). A new
 * run of the event clears it.
 */
export const EVENT_REVIEWS = ['seen', 'ignored', 'fixed'] as const;
export type EventReview = (typeof EVENT_REVIEWS)[number];
