import { describe, expect, it } from 'vitest';
import { nextStatus } from './lifecycle-machine';

describe('table lifecycle', () => {
  it.each([
    ['active', 'SESSION_ENDED', 'awaiting_confirmation'],
    ['awaiting_confirmation', 'HAPPENED', 'concluded'],
    ['awaiting_confirmation', 'NOT_HELD', 'not_held'],
    ['awaiting_confirmation', 'POSTPONE', 'active'],
  ] as const)('moves %s to the right status on %s', (from, event, to) => {
    expect(nextStatus(from, event)).toBe(to);
  });

  it.each([
    ['active', 'HAPPENED'],
    ['active', 'POSTPONE'],
    ['awaiting_confirmation', 'SESSION_ENDED'],
    ['concluded', 'NOT_HELD'],
    ['not_held', 'HAPPENED'],
    ['disabled', 'SESSION_ENDED'],
    ['disabled', 'POSTPONE'],
  ] as const)('has no move from %s on %s: an answer is only asked once', (from, event) => {
    expect(nextStatus(from, event)).toBeNull();
  });
});
