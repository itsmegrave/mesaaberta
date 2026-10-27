import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));
vi.mock('@mesaaberta/core/server/events/handlers', () => ({ handlersFor: () => [] }));
vi.mock('../auth/guard', () => ({ requireUser: async () => ({}) }));
vi.mock('../admin-access', () => ({ requireAdmin: async () => undefined }));

import { catalogActions } from './catalog-actions';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';

const entry = '00000000-0000-4000-8000-000000000a01';
const admin = { id: '00000000-0000-4000-8000-000000000a02', role: 'admin', status: 'active' };

function approve({ api }: { api?: (request: Request) => Promise<Response> }) {
  const tasks: Array<(db: unknown) => Promise<unknown>> = [];
  const form = new FormData();
  form.set('kind', 'platform');
  form.set('id', entry);
  const event = {
    request: new Request('https://test/admin/queue?/approve', { method: 'POST', body: form }),
    url: new URL('https://test/admin/queue'),
    locals: {
      env: api ? { API: { fetch: api } } : {},
      db: {},
      getUser: async () => ({ id: admin.id }),
      afterResponse: (task: (db: unknown) => Promise<unknown>) => tasks.push(task),
      log: { warn: vi.fn() },
    },
  } as unknown as RequestEvent;
  return { event, tasks };
}

beforeEach(() => vi.clearAllMocks());

describe('catalog actions', () => {
  it('lets the api decide, and leaves the event to it', async () => {
    const api = vi.fn(async (_request: Request) => Response.json({ eventId: 'event-from-api' }));
    const { event, tasks } = approve({ api });

    await catalogActions.approve(event);

    const request = api.mock.calls[0][0];
    expect(new URL(request.url).pathname).toBe('/v1/admin/catalog/approve');
    expect(request.headers.get('x-actor-id')).toBe(admin.id);
    expect(await request.json()).toMatchObject({ kind: 'platform', id: entry });
    expect(tasks).toHaveLength(0);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("shows the api's refusal on the form and does not decide a second time", async () => {
    const api = async () =>
      Response.json({ error: 'invalid', field: 'name', message: 'Já decidido' }, { status: 400 });
    const { event, tasks } = approve({ api });

    const result = (await catalogActions.approve(event)) as {
      status: number;
      data: { form: { errors: Record<string, string[]> } };
    };

    expect(result.status).toBe(400);
    expect(result.data.form.errors._errors).toEqual(['Já decidido']);
    expect(tasks).toHaveLength(0);
  });

  it('answers 503 when the api cannot be reached or fails, and dispatches nothing', async () => {
    for (const api of [
      undefined,
      async () => {
        throw new Error('boom');
      },
      async () => Response.json({ error: 'internal_error' }, { status: 500 }),
    ]) {
      const { event, tasks } = approve({ api });

      await expect(catalogActions.approve(event)).rejects.toMatchObject({ status: 503 });
      expect(tasks).toHaveLength(0);
    }
  });
});
