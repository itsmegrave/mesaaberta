// Relative imports only: the Cron Trigger's Worker entry bundles this file without `$lib`.
import type { Changes, FieldChange } from './types';

/** What an edit can carry per field: a plain value, a date, or a list of names. */
export type Fact = string | number | boolean | Date | null | undefined | readonly string[];

/** The longest value kept in an event, per side. Text longer than this is cut with an ellipsis. */
export const CHANGE_VALUE_LIMIT = 300;

const plain = (value: Fact): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'object') return value.length === 0 ? null : value.join(', ');
  return value;
};

const clip = (value: string | number | boolean | null) =>
  typeof value === 'string' && value.length > CHANGE_VALUE_LIMIT
    ? `${value.slice(0, CHANGE_VALUE_LIMIT)}…`
    : value;

/**
 * What an edit changed, field by field: `{ title: { from: 'A', to: 'B' } }`, only for the fields
 * whose value differs. The event is a log that is kept and read by admins, so it follows the rule of
 * the payload (ids and public facts): a field in `hidden` (a join link, a private message, an
 * address) says that it changed and nothing more. Empty text counts as no value.
 */
export function diffFields<Key extends string>(
  before: Partial<Record<NoInfer<Key>, Fact>>,
  after: Record<Key, Fact>,
  { hidden = [] }: { hidden?: readonly string[] } = {},
): Changes {
  const changes: Changes = {};
  for (const field of Object.keys(after) as Key[]) {
    const from = plain(before[field]);
    const to = plain(after[field]);
    if (from === to) continue;
    changes[field] = hidden.includes(field)
      ? { redacted: true }
      : ({ from: clip(from), to: clip(to) } satisfies FieldChange);
  }
  return changes;
}

/** Whether an edit changed anything at all. */
export const hasChanges = (changes: Changes) => Object.keys(changes).length > 0;
