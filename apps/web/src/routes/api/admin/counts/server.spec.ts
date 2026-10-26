import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCounts } from '#lib/server/admin/counts.js';
import { GET } from './+server';

vi.mock('#lib/server/admin/counts.js', () => ({
  adminCounts: vi.fn(async () => ({
    reports: 2,
    queue: 1,
    connections: 0,
    events: 3,
    partners: 0,
    places: 0,
    hiddenPlaces: 0,
  })),
}));

const admin = { id: 'admin', role: 'admin', status: 'active' };
const member = { id: 'member', role: 'member', status: 'active' };

const event = (profile: object | null, db: object | null = {}) =>
  ({ locals: { db, getProfile: async () => profile } }) as unknown as RequestEvent;

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/counts', () => {
  it('gives an admin the counts, never cached', async () => {
    const response = await GET(event(admin) as Parameters<typeof GET>[0]);
    expect(await response.json()).toEqual({
      reports: 2,
      queue: 1,
      connections: 0,
      events: 3,
      partners: 0,
      places: 0,
      hiddenPlaces: 0,
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('answers 404 to a member or a visitor, as the admin area does, without counting', async () => {
    for (const profile of [member, null])
      await expect(GET(event(profile) as Parameters<typeof GET>[0])).rejects.toMatchObject({
        status: 404,
      });
    expect(adminCounts).not.toHaveBeenCalled();
  });

  it('answers 503 without a database', async () => {
    await expect(GET(event(admin, null) as Parameters<typeof GET>[0])).rejects.toMatchObject({
      status: 503,
    });
  });
});
