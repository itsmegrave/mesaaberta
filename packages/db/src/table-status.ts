export const TABLE_STATUSES = [
  'active',
  'disabled',
  'awaiting_confirmation',
  'concluded',
  'not_held',
  // Not public yet: only its GM (and an admin) sees it until it is published.
  'draft',
  // Taken down by its GM (or an admin acting for them) before it was over.
  'cancelled',
  // Taken down by moderation.
  'removed',
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

// Taken down: `disabled` is the old single value, being split into `cancelled` (its GM) and
// `removed` (moderation). Reads treat the three alike until the old rows are moved over.
export const TABLE_DOWN_STATUSES = ['disabled', 'cancelled', 'removed'] as const;
export const isTableDown = (status: string) =>
  (TABLE_DOWN_STATUSES as readonly string[]).includes(status);

// The table is over, whatever its date says: concluded (a campaign the GM finished keeps the date
// its next session would have had), not held, or taken down. It has no next session.
export const isTableOver = (status: TableStatus) =>
  status === 'concluded' || status === 'not_held' || isTableDown(status);

// What became of one session of a table (`table_sessions`): still ahead (or waiting for its GM to
// say whether it happened), it happened, it did not, or the GM called it off beforehand.
export const TABLE_SESSION_STATUSES = ['scheduled', 'held', 'not_held', 'cancelled'] as const;
export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];
