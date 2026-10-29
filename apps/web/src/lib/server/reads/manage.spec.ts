import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { loadManage } from '@mesaaberta/core/server/tables/manage';
import { createTestDb } from '../db/test-db';
import { apiOver } from '../db/test-api';
import { read } from './manage';

vi.mock('#lib/server/invitations/api.js', () => ({
  listTableInvitations: vi.fn(async () => []),
}));
vi.mock('@mesaaberta/core/server/tables/manage', () => ({ loadManage: vi.fn() }));
vi.mock('@mesaaberta/core/server/registrations/waitlist', () => ({
  listWaitlist: vi.fn().mockResolvedValue([]),
}));

const gm = '00000000-0000-4000-8000-0000000000e1';
const another = '00000000-0000-4000-8000-0000000000e2';
let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'gm' },
    { id: another, username: 'admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());

// The api Worker reads the page (over the test database; the table itself is mocked).
const eventAs = (who: { id: string; username: string; role: string }) =>
  ({
    locals: {
      env: apiOver(test.db),
      log: { warn: vi.fn() },
      flags: { isEnabled: async () => false },
      getUser: async () => ({ id: who.id }),
      getProfile: async () => ({ ...who, status: 'active' }),
    },
    url: new URL('https://x.test/t/mesa/manage'),
    params: { slug: 'mesa' },
  }) as unknown as RequestEvent;
const owner = () => eventAs({ id: gm, username: 'gm', role: 'member' });

const manageOf = (status: string) =>
  ({
    table: { id: 't', gmId: gm, imagePath: null, slug: 'mesa', status, startsAt: new Date() },
    canDuplicate: true,
    systemWaiting: false,
    gm: { avatarUrl: null, avatarPath: null },
    gmRating: null,
    requests: [],
    players: [],
    activity: [],
  }) as never;

describe('the manage read', () => {
  it('offers ending only to the owner, including when another administrator can manage seats', async () => {
    vi.mocked(loadManage).mockResolvedValue(manageOf('active'));
    const own = await read(owner());
    expect(own.canEnd).toBe(true);
    expect(own.canInvite).toBe(true);
    const managedByAdmin = await read(eventAs({ id: another, username: 'admin', role: 'admin' }));
    expect(managedByAdmin.canEnd).toBe(false);
    expect(managedByAdmin.canInvite).toBe(false);
    expect(managedByAdmin.invitations).toEqual([]);
  });

  it('offers the edit form while the table can still change', async () => {
    vi.mocked(loadManage).mockResolvedValue(manageOf('active'));
    expect((await read(owner())).canEdit).toBe(true);
  });

  it('does not offer it once the session was confirmed: the edit page would answer 403', async () => {
    vi.mocked(loadManage).mockResolvedValue(manageOf('concluded'));
    expect((await read(owner())).canEdit).toBe(false);
  });
});

it('offers duplication for an owned concluded source without allowing editing', async () => {
  vi.mocked(loadManage).mockResolvedValue(manageOf('concluded'));
  expect((await read(owner())).canDuplicate).toBe(true);
});
