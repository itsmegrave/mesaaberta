import { describe, expect, it } from 'vitest';
import { NAMELESS, atHandle } from './handle';

describe('atHandle', () => {
  it('shows a username with an @', () => {
    expect(atHandle('ana-souza')).toBe('@ana-souza');
  });

  it('shows the placeholder, without an @, for someone who has no username yet', () => {
    expect(atHandle(null)).toBe(NAMELESS);
    expect(atHandle(NAMELESS)).toBe(NAMELESS);
  });
});
