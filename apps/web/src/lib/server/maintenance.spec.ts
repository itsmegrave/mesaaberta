import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleMaintenance, isExempt } from './maintenance';

type Profile = { id: string; role: 'member' | 'admin'; status: 'active' | 'suspended' };

const member: Profile = { id: 'm', role: 'member', status: 'active' };
const admin: Profile = { id: 'a', role: 'admin', status: 'active' };

const SCREEN = '<h1>Voltamos em breve</h1>';

function setup({
  on = true,
  path = '/tables',
  method = 'GET',
  accept = 'text/html,application/xhtml+xml',
  profile = null as Profile | null | Error,
} = {}) {
  const locals = {
    flags: { isEnabled: vi.fn(async (name: string) => on && name === 'maintenance_mode') },
    getProfile: vi.fn(async () => {
      if (profile instanceof Error) throw profile;
      return profile;
    }),
    log: { error: vi.fn() },
  } as unknown as App.Locals;
  const fetch = vi.fn(
    async () =>
      new Response(SCREEN, {
        headers: { 'content-type': 'text/html', 'content-security-policy': "script-src 'self'" },
      }),
  );
  const event = {
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`, { method, headers: { accept } }),
    locals,
    fetch,
  } as unknown as RequestEvent;
  const resolve = vi.fn(async () => new Response('the site'));

  return { event, locals, fetch, resolve, run: () => handleMaintenance({ event, resolve }) };
}

const expectBlocked = (response: Response) => {
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('3600');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-robots-tag')).toBe('noindex');
};

describe('handleMaintenance', () => {
  it('lets everything through while the flag is off', async () => {
    const { run, resolve, locals } = setup({ on: false });

    expect(await (await run()).text()).toBe('the site');
    expect(resolve).toHaveBeenCalled();
    expect(locals.maintenance).toBeUndefined();
  });

  it.each([null, member])('serves the screen with a 503 to a visitor (%j)', async (profile) => {
    const { run, resolve, fetch, locals } = setup({ profile });

    const response = await run();

    expectBlocked(response);
    expect(await response.text()).toBe(SCREEN);
    // The screen's own security policy comes along.
    expect(response.headers.get('content-security-policy')).toBe("script-src 'self'");
    expect(fetch).toHaveBeenCalledWith('/maintenance', expect.anything());
    expect(resolve).not.toHaveBeenCalled();
    expect(locals.maintenance).toBe('blocked');
  });

  it('answers a form post or a data request in plain words, without running it', async () => {
    const { run, resolve, fetch } = setup({ method: 'POST', accept: 'application/json' });

    const response = await run();

    expectBlocked(response);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(
      'A Mesa Aberta está em manutenção no momento. Tente de novo mais tarde.',
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lets an admin use the site, marked as a bypass for the banner', async () => {
    const { run, resolve, locals } = setup({ profile: admin });

    expect(await (await run()).text()).toBe('the site');
    expect(resolve).toHaveBeenCalled();
    expect(locals.maintenance).toBe('bypass');
  });

  it('stops a suspended admin like anyone else', async () => {
    const { run } = setup({ profile: { ...admin, status: 'suspended' } });

    expect((await run()).status).toBe(503);
  });

  it('shows the screen when the profile cannot be read', async () => {
    const { run, locals } = setup({ profile: new Error('database down') });

    expect((await run()).status).toBe(503);
    expect(locals.log.error).toHaveBeenCalled();
  });

  it.each(['/healthz', '/maintenance', '/login', '/login/google', '/auth/callback', '/logout'])(
    'keeps %s reachable',
    async (path) => {
      const { run, resolve } = setup({ path });

      expect(await (await run()).text()).toBe('the site');
      expect(resolve).toHaveBeenCalled();
    },
  );
});

describe('isExempt', () => {
  it.each(['/robots.txt', '/favicon.ico', '/favicon-32x32.png', '/_app/immutable/x.js'])(
    'lets the static file %s through',
    (path) => expect(isExempt(path)).toBe(true),
  );

  it.each([
    '/',
    '/tables',
    '/signup',
    '/onboarding',
    '/account/export',
    '/loginx',
    '/maintenance/x',
  ])('blocks %s', (path) => expect(isExempt(path)).toBe(false));
});
