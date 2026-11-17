import { describe, expect, it, vi } from 'vitest';
import { cepStreetEnabled } from './cep-street';

const locals = (on: boolean, profile: object | null) => {
  const isEnabled = vi.fn(async (name: string) => name === 'use_cep_street' && on);
  return { isEnabled, locals: { flags: { isEnabled }, getProfile: async () => profile } };
};

describe('cepStreetEnabled', () => {
  it('reads use_cep_street for the person, by id', async () => {
    const ana = { id: 'ana', role: 'member', status: 'active' };
    const on = locals(true, ana);
    expect(await cepStreetEnabled(on.locals as never)).toBe(true);
    expect(on.isEnabled).toHaveBeenCalledWith('use_cep_street', { id: 'ana', isAdmin: false });
    expect(await cepStreetEnabled(locals(false, ana).locals as never)).toBe(false);
  });
});
