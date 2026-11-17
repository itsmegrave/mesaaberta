import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keepCodeVerifier } from './code-verifier';

const clientWith = (setItem = vi.fn()) =>
  ({
    auth: { storage: { setItem }, storageKey: 'sb-local-auth-token' },
  }) as unknown as SupabaseClient;

describe('keeping the code verifier', () => {
  it('stores it under the key the callback reads, as it came', async () => {
    const setItem = vi.fn();
    await keepCodeVerifier(clientWith(setItem), '"abc/recovery"');
    expect(setItem).toHaveBeenCalledWith('sb-local-auth-token-code-verifier', '"abc/recovery"');
  });

  it('does nothing without a verifier or a client', async () => {
    const setItem = vi.fn();
    await keepCodeVerifier(clientWith(setItem), null);
    await keepCodeVerifier(clientWith(setItem), '');
    await keepCodeVerifier(null, '"abc"');
    expect(setItem).not.toHaveBeenCalled();
  });
});
