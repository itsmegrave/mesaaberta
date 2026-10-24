import { expect, it, vi } from 'vitest';
import { tableWriteRoutes } from './table-writes';

it('does not open a database for unrelated routes in the duplication alias', async () => {
  const open = vi.fn(() => ({ db: {}, close: async () => {} }));
  const router = tableWriteRoutes(open as never, true);
  const response = await router.request(
    '/mesa/invitations',
    { headers: { 'x-actor-id': '00000000-0000-4000-8000-000000000001' } },
    { DATABASE_URL: 'postgres://test' },
  );
  expect(response.status).toBe(404);
  expect(open).not.toHaveBeenCalled();
});
