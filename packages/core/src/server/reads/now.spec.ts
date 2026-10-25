import { describe, expect, it } from 'vitest';
import { publicReadNow } from './now';

describe('publicReadNow', () => {
  it('gives every moment of the same minute one value, so Hyperdrive can reuse the cached list', () => {
    const early = publicReadNow(new Date('2026-10-25T13:04:00.001Z'));
    const late = publicReadNow(new Date('2026-10-25T13:04:59.999Z'));

    expect(early).toEqual(late);
  });

  it('rounds down, never into the future, so a table that has not started yet stays listed', () => {
    expect(publicReadNow(new Date('2026-10-25T13:04:59.999Z'))).toEqual(
      new Date('2026-10-25T13:04:00.000Z'),
    );
  });

  it('moves on at the next minute, so a started table drops off within a minute', () => {
    expect(publicReadNow(new Date('2026-10-25T13:05:00.000Z'))).toEqual(
      new Date('2026-10-25T13:05:00.000Z'),
    );
  });
});
