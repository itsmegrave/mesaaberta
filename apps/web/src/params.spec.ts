import { describe, expect, it } from 'vitest';
import { matchProvider } from './params';

describe('provider param matcher', () => {
  it.each(['google', 'discord'])('accepts %s', (provider) => {
    expect(matchProvider(provider)).toBe(provider);
  });

  // Only what is set up in Supabase is offered. (Supabase calls Meta "facebook", if it is added back.)
  it.each(['github', 'apple', 'facebook', 'meta', 'Google', ''])('rejects %j', (provider) => {
    expect(matchProvider(provider)).toBeUndefined();
  });
});
