import { afterEach, describe, expect, it, vi } from 'vitest';
import { stringify } from 'devalue';
import { apiRead } from './http';
afterEach(() => vi.unstubAllGlobals());
describe('API transport', () => {
  it('preserves dates, cookies and cancellation through the same-origin transport', async () => {
    const when = new Date('2026-01-01');
    const request = vi.fn().mockResolvedValue(
      new Response(stringify({ when }), {
        headers: {
          'content-type': 'application/json',
          'x-query-codec': 'devalue',
          'x-query-viewer': 'ana',
        },
      }),
    );
    vi.stubGlobal('fetch', request);
    const signal = new AbortController().signal;
    expect(await apiRead('/api/query/detail?slug=mesa', signal, 'ana')).toEqual({ when });
    expect(request).toHaveBeenCalledWith(
      '/api/query/detail?slug=mesa',
      expect.objectContaining({ signal, credentials: 'same-origin' }),
    );
  });
  it('refuses a response for a different signed-in account before caching its body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'content-type': 'application/json', 'x-query-viewer': 'bia' },
        }),
      ),
    );
    await expect(apiRead('/api/query/account', undefined, 'ana')).rejects.toMatchObject({
      status: 401,
    });
  });
  it.each([403, 404, 429, 503])('preserves status %i without a viewer header', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(apiRead('/api/query/manage', undefined, 'ana')).rejects.toMatchObject({ status });
  });
  it.each([
    ['text/html', '<html>login</html>'],
    ['application/json', 'broken json'],
  ])('rejects malformed %s responses', async (type, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': type } })),
    );
    await expect(apiRead('/api/query/tables')).rejects.toMatchObject({ status: 502 });
  });
  it('does not fetch external URLs', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(apiRead('//example.com')).rejects.toThrow('same-origin');
    expect(request).not.toHaveBeenCalled();
  });
});
