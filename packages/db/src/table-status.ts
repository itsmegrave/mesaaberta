export const TABLE_STATUSES = [
  'active',
  'disabled',
  'awaiting_confirmation',
  'concluded',
  'not_held',
  // Not public yet: only its GM (and an admin) sees it until it is published.
  'draft',
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

// What became of one session of a table (`table_sessions`): still ahead (or waiting for its GM to
// say whether it happened), it happened, it did not, or the GM called it off beforehand.
export const TABLE_SESSION_STATUSES = ['scheduled', 'held', 'not_held', 'cancelled'] as const;
export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];
