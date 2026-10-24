import { describe, expect, it, vi } from 'vitest';
import { changePasswordWithToken } from './password';

const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };
const auth = (request: typeof fetch) => ({ url: 'https://s.test/', key: 'k', request, log });

describe('changePasswordWithToken', () => {
  it('never logs the token or the password when Supabase refuses', async () => {
    const request = vi.fn(
      async () => new Response('{}', { status: 500 }),
    ) as unknown as typeof fetch;

    expect(
      await changePasswordWithToken(auth(request), { token: 'jwt-secret', password: 'pw-secret' }),
    ).toBe('failed');
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/jwt-secret|pw-secret/);
  });

  it('still answers ok when signing the other sessions out fails', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new Error('down')) as unknown as typeof fetch;

    expect(await changePasswordWithToken(auth(request), { token: 't', password: 'p' })).toBe('ok');
  });
});
