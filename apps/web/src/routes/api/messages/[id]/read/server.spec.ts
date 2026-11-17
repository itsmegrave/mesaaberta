import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const api = vi.fn<(request: Request) => Promise<Response>>();
beforeEach(() => {
  vi.resetAllMocks();
  api.mockImplementation(async () => Response.json({ eventIds: [] }));
});

const event = (user: { id: string } | null) =>
  ({
    locals: { getUser: async () => user, env: { API: { fetch: api } }, log: { warn: vi.fn() } },
    params: { id: 'thread' },
  }) as unknown as Parameters<typeof POST>[0];

describe('marking a conversation read', () => {
  it('rejects anonymous requests before marking anything', async () => {
    await expect(POST(event(null))).rejects.toMatchObject({ status: 401 });
    expect(api).not.toHaveBeenCalled();
  });

  it('asks the api to mark it read for the signed-in reader', async () => {
    const response = await POST(event({ id: 'ana' }));
    expect(response.status).toBe(204);
    const request = api.mock.lastCall![0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/v1/messages/thread/read');
    expect(request.headers.get('x-actor-id')).toBe('ana');
  });

  it('answers the 404 the api gives for someone else’s conversation', async () => {
    api.mockImplementation(async () => Response.json({ error: 'not_found' }, { status: 404 }));
    await expect(POST(event({ id: 'ana' }))).rejects.toMatchObject({ status: 404 });
  });
});
