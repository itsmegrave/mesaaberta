import { describe, expect, it, vi } from 'vitest';
import { sourceReader } from './source-fetch';
const resolve = async () => ['93.184.216.34'];
describe('bounded source fetch', () => {
  it('rejects unapproved hosts before fetching and private DNS answers', async () => {
    const fetcher = vi.fn();
    await expect(
      sourceReader('catarse', { fetcher, resolve })('https://catarse.com.br.evil.test/'),
    ).rejects.toThrow();
    await expect(
      sourceReader('catarse', { fetcher, resolve: async () => ['127.0.0.1'] })(
        'https://www.catarse.com.br/',
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates every redirect and enforces size, status and content type', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('', { status: 302, headers: { location: 'https://attacker.test/' } }),
    );
    await expect(
      sourceReader('catarse', { fetcher, resolve })('https://www.catarse.com.br/'),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
    for (const response of [
      new Response('big', {
        headers: { 'content-type': 'text/html', 'content-length': '99999999' },
      }),
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      new Response('blocked', { status: 403 }),
    ]) {
      await expect(
        sourceReader('catarse', { fetcher: async () => response, resolve })(
          'https://www.catarse.com.br/',
        ),
      ).rejects.toThrow();
    }
  });
  it('retries transient failures but keeps one bounded request deadline', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { headers: { 'content-type': 'text/html' } }));
    expect(await sourceReader('catarse', { fetcher, resolve })('https://www.catarse.com.br/')).toBe(
      'ok',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('times out a response body that never finishes', async () => {
    const fetcher = async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('partial'));
          },
        }),
        { headers: { 'content-type': 'text/html' } },
      );
    await expect(
      sourceReader('catarse', { fetcher, resolve, timeoutMs: 10 })('https://www.catarse.com.br/'),
    ).rejects.toThrow('source_timeout');
  });
});
