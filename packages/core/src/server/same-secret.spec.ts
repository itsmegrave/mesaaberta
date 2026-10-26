import { describe, expect, it } from 'vitest';
import { sameSecret } from './same-secret';

describe('sameSecret', () => {
  it('matches only the exact secret', () => {
    expect(sameSecret('s3cret', 's3cret')).toBe(true);
    expect(sameSecret('s3creT', 's3cret')).toBe(false);
    expect(sameSecret('s3cre', 's3cret')).toBe(false);
  });

  it('never matches an unset secret', () => {
    expect(sameSecret('', '')).toBe(false);
  });
});
