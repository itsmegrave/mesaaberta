import { describe, expect, it, vi } from 'vitest';
import {
  finishPasskeyLogin,
  finishRegistration,
  listPasskeys,
  parseCredential,
  removePasskey,
  signInChallenge,
} from './passkeys';

const log = () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});

const credential = {
  id: 'cred',
  rawId: 'cred',
  type: 'public-key',
  response: { clientDataJSON: 'x' },
};

const client = (passkey: Record<string, unknown>, signOut = vi.fn().mockResolvedValue({})) =>
  ({ auth: { passkey, signOut } }) as never;

describe('parseCredential', () => {
  it('takes a public-key credential in JSON', () => {
    expect(parseCredential(JSON.stringify(credential))).toEqual(credential);
  });

  it.each([
    '',
    'not json',
    '[]',
    '{"id":"a","type":"password","response":{}}',
    '{"type":"public-key"}',
  ])('refuses %j', (text) => expect(parseCredential(text)).toBeNull());

  it('refuses anything too long to be a credential', () => {
    expect(parseCredential(`{"id":"${'a'.repeat(70_000)}"}`)).toBeNull();
  });
});

describe('signInChallenge', () => {
  it('hands the challenge on and passes the CAPTCHA token to Supabase', async () => {
    const startAuthentication = vi.fn().mockResolvedValue({
      data: { challenge_id: 'ch-1', options: { challenge: 'abc' }, expires_at: 1 },
      error: null,
    });
    const challenge = await signInChallenge(client({ startAuthentication }), log() as never, 'tok');
    expect(challenge).toEqual({ challengeId: 'ch-1', options: { challenge: 'abc' } });
    expect(startAuthentication).toHaveBeenCalledWith({ options: { captchaToken: 'tok' } });
  });

  it('is null when Supabase refuses (passkeys off, CAPTCHA missing)', async () => {
    const startAuthentication = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'passkeys_disabled', status: 400 } });
    const logger = log();
    expect(await signInChallenge(client({ startAuthentication }), logger as never)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('auth.passkey_options_failed', {
      code: 'passkeys_disabled',
      status: 400,
    });
  });
});

describe('finishPasskeyLogin', () => {
  const session = { access_token: 'jwt-a', refresh_token: 'jwt-r' };
  const user = { id: 'u1', user_metadata: {} };

  it('finishes like a provider sign-in, with the new access token', async () => {
    const verifyAuthentication = vi
      .fn()
      .mockResolvedValue({ data: { session, user }, error: null });
    const remote = vi.fn().mockResolvedValue({ result: 'ok', target: '/tables' });
    const target = await finishPasskeyLogin(
      {
        supabase: client({ verifyAuthentication }),
        db: null,
        log: log() as never,
        ip: null,
        remote,
      },
      { challengeId: 'ch-1', credential, next: '/tables' },
    );
    expect(target).toBe('/tables');
    expect(verifyAuthentication).toHaveBeenCalledWith({ challengeId: 'ch-1', credential });
    expect(remote).toHaveBeenCalledWith('jwt-a', '/tables');
  });

  it('signs out again when the api refuses the account', async () => {
    const verifyAuthentication = vi
      .fn()
      .mockResolvedValue({ data: { session, user }, error: null });
    const signOut = vi.fn().mockResolvedValue({});
    const target = await finishPasskeyLogin(
      {
        supabase: client({ verifyAuthentication }, signOut),
        db: null,
        log: log() as never,
        ip: null,
        remote: async () => ({ result: 'suspended' }),
      },
      { challengeId: 'ch-1', credential, next: null },
    );
    expect(target).toBe('/login?error=suspended');
    expect(signOut).toHaveBeenCalled();
  });

  it('is null when Supabase refuses the passkey, without asking the api', async () => {
    const verifyAuthentication = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'webauthn_verification_failed' } });
    const remote = vi.fn();
    expect(
      await finishPasskeyLogin(
        {
          supabase: client({ verifyAuthentication }),
          db: null,
          log: log() as never,
          ip: null,
          remote,
        },
        { challengeId: 'ch-1', credential, next: null },
      ),
    ).toBeNull();
    expect(remote).not.toHaveBeenCalled();
  });
});

describe('managing passkeys', () => {
  it('keeps a new passkey Supabase accepted', async () => {
    const verifyRegistration = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
    expect(
      await finishRegistration(client({ verifyRegistration }), log() as never, {
        challengeId: 'ch-1',
        credential,
      }),
    ).toBe(true);
  });

  it('lists them newest first, with an empty name as none', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: 'a', friendly_name: '', created_at: '2026-01-01T00:00:00Z' },
        {
          id: 'b',
          friendly_name: 'iPhone',
          created_at: '2026-02-01T00:00:00Z',
          last_used_at: '2026-03-01T00:00:00Z',
        },
      ],
      error: null,
    });
    expect(await listPasskeys(client({ list }), log() as never)).toEqual([
      {
        id: 'b',
        name: 'iPhone',
        createdAt: '2026-02-01T00:00:00Z',
        lastUsedAt: '2026-03-01T00:00:00Z',
      },
      { id: 'a', name: null, createdAt: '2026-01-01T00:00:00Z', lastUsedAt: null },
    ]);
  });

  it('says when a removal failed', async () => {
    const remove = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'not_found', status: 404 } });
    expect(await removePasskey(client({ delete: remove }), log() as never, 'p1')).toBe(false);
    expect(remove).toHaveBeenCalledWith({ passkeyId: 'p1' });
  });
});
