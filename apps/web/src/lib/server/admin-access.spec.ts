import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleAdminAccess, isAdminPath } from './admin-access';

type Profile = { id: string; role: 'member' | 'admin'; status: 'active' | 'suspended' };

const member: Profile = { id: 'm', role: 'member', status: 'active' };
const admin: Profile = { id: 'a', role: 'admin', status: 'active' };

function setup({
  path = '/admin',
  method = 'GET',
  profile = null as Profile | null | Error,
  routeId = null as string | null,
  accept = 'text/html',
  isDataRequest = false,
} = {}) {
  const afterResponse = vi.fn();
  const event = {
    url: new URL(`http://localhost${path}`),
    route: { id: routeId },
    isDataRequest,
    request: new Request(`http://localhost${path}`, { method, headers: { accept } }),
    locals: {
      afterResponse,
      getProfile: vi.fn(async () => {
        if (profile instanceof Error) throw profile;
        return profile;
      }),
    },
  } as unknown as RequestEvent;
  const resolve = vi.fn(async () => new Response('admin content'));

  return { event, resolve, afterResponse, run: () => handleAdminAccess({ event, resolve }) };
}

describe('handleAdminAccess', () => {
  it.each([null, member, { ...admin, status: 'suspended' } as Profile, new Error('database down')])(
    'returns a 404 for a non-admin or unavailable profile (%j)',
    async (profile) => {
      const { run, resolve } = setup({ profile });

      await expect(run()).rejects.toMatchObject({ status: 404 });
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it('lets an active admin through', async () => {
    const { run, resolve } = setup({ profile: admin });

    expect(await (await run()).text()).toBe('admin content');
    expect(resolve).toHaveBeenCalled();
  });

  it('notes the entry after the response when an admin opens a page or its data', async () => {
    for (const request of [{}, { accept: '*/*', isDataRequest: true }]) {
      const { run, afterResponse } = setup({
        path: '/admin/users/x',
        routeId: '/admin/users/[id]',
        profile: admin,
        ...request,
      });
      await run();
      expect(afterResponse).toHaveBeenCalledTimes(1);
    }
  });

  it('notes nothing for an action or an endpoint', async () => {
    for (const request of [{ method: 'POST' }, { accept: 'application/json' }]) {
      const { run, afterResponse } = setup({
        path: '/admin/events',
        routeId: '/admin/events',
        profile: admin,
        ...request,
      });
      await run();
      expect(afterResponse).not.toHaveBeenCalled();
    }
  });

  it('applies the same 404 gate to nested form actions and data routes', async () => {
    const { run, resolve } = setup({ path: '/admin/users', method: 'POST', profile: member });

    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('does not block non-admin paths', async () => {
    const { run, resolve } = setup({ path: '/tables', profile: member });

    expect(await (await run()).text()).toBe('admin content');
    expect(resolve).toHaveBeenCalled();
  });
});

describe('isAdminPath', () => {
  it.each(['/admin', '/admin/', '/admin/users', '/admin/users/__data.json'])(
    'recognizes %s',
    (path) => expect(isAdminPath(path)).toBe(true),
  );

  it.each(['/administrator', '/t/admin', '/administer'])('does not recognize %s', (path) =>
    expect(isAdminPath(path)).toBe(false),
  );

  it.each([
    ['an encoded path', '/%61dmin/notifications', null],
    ['an upper-case path', '/ADMIN', null],
    [
      'a localized path that lands on an admin route',
      '/en/admin/notifications',
      '/admin/notifications',
    ],
  ])('hides the admin area behind %s', async (_, path, routeId) => {
    const { run, resolve } = setup({ path, profile: member, routeId });

    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(resolve).not.toHaveBeenCalled();
  });
});
