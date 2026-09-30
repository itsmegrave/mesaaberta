import type { RequestEvent } from '@sveltejs/kit';
import { expect, it, vi } from 'vitest';
import { read } from './admin';

it.each([
  null,
  { id: '1', role: 'member', status: 'active' },
  { id: '1', role: 'admin', status: 'suspended' },
])('protects the admin query endpoint for %j', async (profile) => {
  const db = { select: vi.fn() };
  await expect(
    read({
      locals: { getProfile: async () => profile, db },
      setHeaders: vi.fn(),
    } as unknown as RequestEvent),
  ).rejects.toMatchObject({ status: 404 });
  expect(db.select).not.toHaveBeenCalled();
});

it('reports an unavailable database to an authorized admin', async () => {
  await expect(
    read({
      locals: { getProfile: async () => ({ id: '1', role: 'admin', status: 'active' }), db: null },
      setHeaders: vi.fn(),
    } as unknown as RequestEvent),
  ).rejects.toMatchObject({ status: 503 });
});
