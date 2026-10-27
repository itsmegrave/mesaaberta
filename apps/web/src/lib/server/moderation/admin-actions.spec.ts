import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));
vi.mock('@mesaaberta/core/server/events/handlers', () => ({ handlersFor: () => [] }));
vi.mock('../auth/guard', () => ({
  requireUser: async () => ({ id: '00000000-0000-4000-8000-000000000b02' }),
}));
vi.mock('../admin-access', () => ({ requireAdmin: async () => undefined }));

import { partnerActions } from './admin-actions';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';

const partner = '00000000-0000-4000-8000-000000000b01';
const admin = { id: '00000000-0000-4000-8000-000000000b02', role: 'admin', status: 'active' };

function approve(api?: (request: Request) => Promise<Response>) {
  const tasks: Array<(db: unknown) => Promise<unknown>> = [];
  const form = new FormData();
  form.set('id', partner);
  const event = {
    request: new Request('https://test/admin/partners?/approve', { method: 'POST', body: form }),
    url: new URL('https://test/admin/partners'),
    locals: {
      env: api ? { API: { fetch: api } } : {},
      db: {},
      getProfile: async () => admin,
      afterResponse: (task: (db: unknown) => Promise<unknown>) => tasks.push(task),
      log: { warn: vi.fn() },
    },
  } as unknown as RequestEvent;
  return { event, tasks };
}

beforeEach(() => vi.clearAllMocks());

describe('admin moderation actions', () => {
  it('let the api decide and dispatch every event it answers with', async () => {
    const api = vi.fn(async (_request: Request) => Response.json({ eventIds: ['e1', 'e2'] }));
    const { event, tasks } = approve(api);

    await partnerActions.approve(event);

    const request = api.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/v1/admin/moderation/partner.approve');
    expect(request.headers.get('x-actor-id')).toBe(admin.id);
    expect(await request.json()).toMatchObject({ id: partner });
    await tasks[0]({});
    expect(vi.mocked(dispatchEvent).mock.calls.map((call) => call[2])).toEqual(['e1', 'e2']);
  });

  it("show the api's refusal on the form and never decide a second time", async () => {
    const api = async () =>
      Response.json(
        { error: 'invalid', field: 'id', message: 'already_approved' },
        { status: 400 },
      );
    const { event, tasks } = approve(api);

    const result = (await partnerActions.approve(event)) as {
      status: number;
      data: { form: { errors: Record<string, string[]> } };
    };

    expect(result.status).toBe(400);
    expect(result.data.form.errors.id).toEqual(['already_approved']);
    expect(tasks).toHaveLength(0);
  });

  it('answer 503 when the api cannot be reached, and dispatch nothing', async () => {
    const { event, tasks } = approve();

    await expect(partnerActions.approve(event)).rejects.toMatchObject({ status: 503 });
    expect(tasks).toHaveLength(0);
  });
});
