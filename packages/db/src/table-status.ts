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
