import { describe, expect, it, vi } from 'vitest';
import { readFromApi } from './api-read';

const locals = (answer: { status: number; body: object } | 'down') =>
  ({
    env: {
      API: {
        fetch: vi.fn(async (_request: Request) =>
          answer === 'down'
            ? Promise.reject(new Error('down'))
            : new Response(JSON.stringify(answer.body), { status: answer.status }),
        ),
      },
    },
    log: { warn: vi.fn() },
  }) as unknown as App.Locals & { env: { API: { fetch: ReturnType<typeof vi.fn> } } };

describe('readFromApi', () => {
  it('answers what the api read, as the person named or as a visitor', async () => {
    const signedIn = locals({ status: 200, body: { n: 1 } });
    await expect(readFromApi(signedIn, 'p1', '/v1/reads/catalog')).resolves.toEqual({ n: 1 });
    const request = signedIn.env.API.fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('GET');
    expect(request.headers.get('x-actor-id')).toBe('p1');

    const visitor = locals({ status: 200, body: { n: 2 } });
    await expect(readFromApi(visitor, null, '/v1/reads/preview')).resolves.toEqual({ n: 2 });
    expect(
      (visitor.env.API.fetch.mock.calls[0][0] as Request).headers.get('x-actor-id'),
    ).toBeNull();
  });

  it("turns the api's refusals into the page's own errors", async () => {
    const read = (status: number, error: string) =>
      readFromApi(locals({ status, body: { error } }), 'p1', '/v1/reads/manage/x');
    await expect(read(404, 'not_found')).rejects.toMatchObject({ status: 404 });
    await expect(read(403, 'forbidden')).rejects.toMatchObject({ status: 403 });
    await expect(read(403, 'table_concluded')).rejects.toMatchObject({
      status: 403,
      body: { code: 'table_concluded' },
    });
  });

  it('is a 503 when the api fails or cannot be reached, never a local read', async () => {
    await expect(
      readFromApi(locals({ status: 500, body: { error: 'internal_error' } }), 'p1', '/v1/reads/x'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(readFromApi(locals('down'), 'p1', '/v1/reads/x')).rejects.toMatchObject({
      status: 503,
    });
  });
});
