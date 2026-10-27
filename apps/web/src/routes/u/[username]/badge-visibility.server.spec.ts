import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';
import { NotFound } from '@mesaaberta/core/server/errors';
import { writeViaApi } from '#lib/server/api-write.js';

// The api Worker keeps the switch; its route is covered in apps/api's me spec.
vi.mock('#lib/server/api-write.js', () => ({ writeViaApi: vi.fn() }));
vi.mock('#lib/server/auth/guard.js', () => ({
  requireUser: vi.fn(async () => ({ id: 'me' })),
}));
vi.mock('@mesaaberta/core/server/profile/public', () => ({ publicProfile: vi.fn() }));

const run = (username: string, body: Record<string, string>, own = 'ana') =>
  actions.badgeVisibility({
    locals: { getProfile: async () => ({ id: 'me', username: own }) },
    params: { username },
    request: new Request('https://mesaaberta.app/u/ana', {
      method: 'POST',
      body: new URLSearchParams(body),
    }),
    url: new URL('https://mesaaberta.app/u/ana'),
  } as unknown as Parameters<typeof actions.badgeVisibility>[0]);

beforeEach(() => vi.mocked(writeViaApi).mockReset().mockResolvedValue({ eventIds: [], body: {} }));

describe('the badge visibility action', () => {
  it('hides and shows a badge of the signed-in owner', async () => {
    await expect(run('ana', { badgeId: 'first-table', hidden: '1' })).resolves.toMatchObject({
      form: { valid: true },
    });
    expect(writeViaApi).toHaveBeenLastCalledWith(
      expect.anything(),
      { id: 'me' },
      '/v1/me/badges/first-table/hidden',
      { hidden: true },
    );

    await run('Ana', { badgeId: 'first-table', hidden: '0' });
    expect(vi.mocked(writeViaApi).mock.lastCall?.[3]).toEqual({ hidden: false });
  });

  it('refuses anyone but the owner of the profile', async () => {
    await expect(run('bruno', { badgeId: 'first-table', hidden: '1' })).rejects.toMatchObject({
      status: 403,
    });
    expect(writeViaApi).not.toHaveBeenCalled();
  });

  it('refuses a malformed request without calling the api', async () => {
    await expect(run('ana', { badgeId: 'First Table', hidden: '1' })).resolves.toMatchObject({
      status: 400,
    });
    await expect(run('ana', { badgeId: 'first-table', hidden: 'yes' })).resolves.toMatchObject({
      status: 400,
    });
    expect(writeViaApi).not.toHaveBeenCalled();
  });

  it('answers 404 for a badge the owner does not hold', async () => {
    vi.mocked(writeViaApi).mockRejectedValueOnce(new NotFound());

    await expect(run('ana', { badgeId: 'partner', hidden: '1' })).resolves.toMatchObject({
      status: 404,
    });
  });
});
