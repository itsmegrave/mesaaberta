import { describe, expect, it, vi } from 'vitest';
import { enforceLocalOnly, isLocalHost, localOnlyFetch, localOnlyProblems } from './local-only';

describe('isLocalHost', () => {
  it.each([
    'localhost',
    'app.localhost',
    'mesaaberta.local',
    'db',
    'supabase',
    '127.0.0.1',
    '10.0.0.5',
    '172.18.0.4',
    '192.168.1.10',
    '[::1]',
    'fd00::1',
  ])('%s is local', (host) => expect(isLocalHost(host)).toBe(true));

  it.each([
    'abc.supabase.co',
    'api.resend.com',
    'cdn.growthbook.io',
    '8.8.8.8',
    '172.32.0.1',
    '2001:db8::1',
  ])('%s is not', (host) => expect(isLocalHost(host)).toBe(false));
});

describe('localOnlyProblems', () => {
  it('passes the Docker stack', () => {
    expect(
      localOnlyProblems({
        DATABASE_URL: 'postgres://mesaaberta:mesaaberta@db:5432/mesaaberta',
        SUPABASE_URL: 'http://supabase:8000',
        API_URL: 'http://api:8788',
        MAILPIT_URL: 'http://mailpit:8025',
        RESEND_API_KEY: '',
      }),
    ).toEqual([]);
  });

  it('names each setting that reaches outside', () => {
    expect(
      localOnlyProblems({
        SUPABASE_URL: 'https://abc.supabase.co',
        GROWTHBOOK_API_HOST: 'https://cdn.growthbook.io',
        DATABASE_URL: 'not a url',
        RESEND_API_KEY: 're_123',
        SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
      }),
    ).toEqual([
      'DATABASE_URL is not a URL',
      'SUPABASE_URL points at abc.supabase.co',
      'GROWTHBOOK_API_HOST points at cdn.growthbook.io',
      'RESEND_API_KEY is set',
      'SENTRY_DSN is set',
    ]);
  });
});

describe('localOnlyFetch', () => {
  it('lets a local request through and refuses a public one', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const guarded = localOnlyFetch(base as unknown as typeof fetch);

    await expect(guarded('http://mailpit:8025/api/v1/info')).resolves.toBeInstanceOf(Response);
    await expect(guarded(new URL('https://api.resend.com/emails'))).rejects.toThrow(
      'LOCAL_ONLY: refused a request to api.resend.com',
    );
    await expect(guarded(new Request('https://viacep.com.br/ws/01001000/json/'))).rejects.toThrow(
      'viacep.com.br',
    );
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe('enforceLocalOnly', () => {
  const target = () => ({
    fetch: vi.fn(async () => new Response('ok')) as unknown as typeof fetch,
  });

  it('does nothing unless LOCAL_ONLY is true', () => {
    const host = target();
    const original = host.fetch;
    expect(enforceLocalOnly({ SUPABASE_URL: 'https://abc.supabase.co' }, host)).toBe(false);
    expect(host.fetch).toBe(original);
  });

  it('refuses to start with an outside setting', () => {
    expect(() =>
      enforceLocalOnly({ LOCAL_ONLY: 'true', SUPABASE_URL: 'https://abc.supabase.co' }, target()),
    ).toThrow('SUPABASE_URL points at abc.supabase.co');
  });

  it('swaps fetch for the local one', async () => {
    const host = target();
    expect(enforceLocalOnly({ LOCAL_ONLY: 'true' }, host)).toBe(true);
    await expect(host.fetch('https://example.com/')).rejects.toThrow('example.com');
  });
});
