import { describe, expect, it } from 'vitest';
import type { Extension } from './contract';
import { extensionFlagDefaults } from './index';

const ext = (id: string, flags?: Record<string, boolean>): Extension => ({ id, flags });

describe('extensionFlagDefaults', () => {
  it('merges the flags of every extension', () => {
    expect(
      extensionFlagDefaults([ext('a', { a_flag: true }), ext('b', { b_flag: false }), ext('c')]),
    ).toEqual({ a_flag: true, b_flag: false });
  });

  it('refuses a name the app already uses', () => {
    expect(() => extensionFlagDefaults([ext('a', { maintenance_mode: true })])).toThrow(
      /already taken/,
    );
  });

  it('refuses a name two extensions both declare', () => {
    expect(() =>
      extensionFlagDefaults([ext('a', { shared: true }), ext('b', { shared: false })]),
    ).toThrow(/already taken/);
  });
});
