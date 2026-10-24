import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { loadManage } from '@mesaaberta/core/server/tables/manage';
import { read } from './manage';

vi.mock('#lib/server/invitations/api.js', () => ({
  listTableInvitations: vi.fn(async () => []),
}));
vi.mock('@mesaaberta/core/server/tables/manage', () => ({ loadManage: vi.fn() }));

const event = {
  locals: {
    db: {},
    env: {},
    getUser: async () => ({ id: 'gm' }),
    getProfile: async () => ({ id: 'gm', username: 'gm', role: 'user', status: 'active' }),
  },
  url: new URL('https://x.test/t/mesa/manage'),
  params: { slug: 'mesa' },
} as unknown as RequestEvent;

const manageOf = (status: string) =>
  ({
    table: { id: 't', gmId: 'gm', imagePath: null, slug: 'mesa', status },
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
    expect((await read(event)).canEnd).toBe(true);
    const admin = {
      ...event,
      locals: {
        ...event.locals,
        getProfile: async () => ({
          id: 'another',
          username: 'admin',
          role: 'admin',
          status: 'active',
        }),
      },
    } as unknown as RequestEvent;
    expect((await read(admin)).canEnd).toBe(false);
  });

  it('offers the edit form while the table can still change', async () => {
    vi.mocked(loadManage).mockResolvedValue(manageOf('active'));
    expect((await read(event)).canEdit).toBe(true);
  });

  it('does not offer it once the session was confirmed: the edit page would answer 403', async () => {
    vi.mocked(loadManage).mockResolvedValue(manageOf('concluded'));
    expect((await read(event)).canEdit).toBe(false);
  });
});

it('offers duplication for an owned concluded source without allowing editing', async () => {
  vi.mocked(loadManage).mockResolvedValue(manageOf('concluded'));
  expect((await read(event)).canDuplicate).toBe(true);
});
