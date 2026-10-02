export const TABLE_STATUSES = [
  'active',
  'disabled',
  'awaiting_confirmation',
  'concluded',
  'not_held',
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];
