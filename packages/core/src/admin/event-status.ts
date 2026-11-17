/**
 * Where an event stands in the queue. `failed` (given up on) is what needs a person, so it is the
 * tab the page opens on.
 */
export const EVENT_STATUSES = ['failed', 'retrying', 'pending', 'running', 'processed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// What an admin said about an event that was given up on (the values live with the schema).
export { EVENT_REVIEWS, type EventReview } from '@mesaaberta/db/event-review';
