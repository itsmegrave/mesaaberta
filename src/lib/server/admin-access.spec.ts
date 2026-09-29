import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { handleAdminAccess, isAdminPath } from './admin-access';

type Profile = { id: string; role: 'member' | 'admin'; status: 'active' | 'suspended' };

const member: Profile = { id: 'm', role: 'member', status: 'active' };
const admin: Profile = { id: 'a', role: 'admin', status: 'active' };

function setup({ path = '/admin', method = 'GET', profile = null as Profile | null | Error } = {}) {
  const event = {
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`, { method }),
    locals: {
      getProfile: vi.fn(async () => {
        if (profile instanceof Error) throw profile;
        return profile;
      }),
    },
  } as unknown as RequestEvent;
  const resolve = vi.fn(async () => new Response('admin content'));

  return { event, resolve, run: () => handleAdminAccess({ event, resolve }) };
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

  it.each(['/administrator', '/tables/admin', '/administer'])('does not recognize %s', (path) =>
    expect(isAdminPath(path)).toBe(false),
  );
});
