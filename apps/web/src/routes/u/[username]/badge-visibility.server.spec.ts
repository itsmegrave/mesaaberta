import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';
import { setBadgeHidden } from '@mesaaberta/core/server/badges/reads';

vi.mock('@mesaaberta/core/server/badges/reads', () => ({ setBadgeHidden: vi.fn() }));
vi.mock('#lib/server/auth/guard.js', () => ({
  requireUser: vi.fn(async () => ({ id: 'me' })),
}));
vi.mock('@mesaaberta/core/server/profile/public', () => ({ publicProfile: vi.fn() }));

const run = (username: string, body: Record<string, string>, own = 'ana') =>
  actions.badgeVisibility({
    locals: { db: {}, getProfile: async () => ({ id: 'me', username: own }) },
    params: { username },
    request: new Request('https://mesaaberta.app/u/ana', {
      method: 'POST',
      body: new URLSearchParams(body),
    }),
    url: new URL('https://mesaaberta.app/u/ana'),
  } as unknown as Parameters<typeof actions.badgeVisibility>[0]);

beforeEach(() => vi.mocked(setBadgeHidden).mockReset().mockResolvedValue(true));

describe('the badge visibility action', () => {
  it('hides and shows a badge of the signed-in owner', async () => {
    await expect(run('ana', { badgeId: 'first-table', hidden: '1' })).resolves.toMatchObject({
      form: { valid: true },
    });
    expect(setBadgeHidden).toHaveBeenLastCalledWith({}, 'me', 'first-table', true);

    await run('Ana', { badgeId: 'first-table', hidden: '0' });
    expect(setBadgeHidden).toHaveBeenLastCalledWith({}, 'me', 'first-table', false);
  });

  it('refuses anyone but the owner of the profile', async () => {
    await expect(run('bruno', { badgeId: 'first-table', hidden: '1' })).rejects.toMatchObject({
      status: 403,
    });
    expect(setBadgeHidden).not.toHaveBeenCalled();
  });

  it('refuses a malformed request without touching the database', async () => {
    await expect(run('ana', { badgeId: 'First Table', hidden: '1' })).resolves.toMatchObject({
      status: 400,
    });
    await expect(run('ana', { badgeId: 'first-table', hidden: 'yes' })).resolves.toMatchObject({
      status: 400,
    });
    expect(setBadgeHidden).not.toHaveBeenCalled();
  });

  it('answers 404 for a badge the owner does not hold', async () => {
    vi.mocked(setBadgeHidden).mockResolvedValue(false);

    await expect(run('ana', { badgeId: 'partner', hidden: '1' })).resolves.toMatchObject({
      status: 404,
    });
  });
});
