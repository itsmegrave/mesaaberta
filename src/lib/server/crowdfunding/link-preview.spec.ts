import { describe, expect, it, vi } from 'vitest';
import { readLinkPreview, readMeta, readRemoteImage, type Resolver } from './link-preview';

const publicDns: Resolver = async () => ['93.184.216.34'];
const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });

describe('readMeta', () => {
  const base = new URL('https://catarse.me/projeto');

  it('prefers Open Graph, decodes entities and makes the image absolute', () => {
    const meta = readMeta(
      `<head><title>Fallback</title>
			<meta property="og:title" content="Tormenta &amp; Cia">
			<meta property="og:image" content="/img/capa.png"></head>`,
      base,
    );

    expect(meta).toEqual({ title: 'Tormenta & Cia', imageUrl: 'https://catarse.me/img/capa.png' });
  });

  it('falls back to the title tag, and to nothing', () => {
    expect(readMeta('<head><title> Só o título </title></head>', base).title).toBe('Só o título');
    expect(readMeta('<p>nada</p>', base)).toEqual({ title: null, imageUrl: null });
  });

  it('ignores meta tags written after the head', () => {
    const meta = readMeta(
      '<head></head><body><meta property="og:title" content="Injected"></body>',
      base,
    );

    expect(meta.title).toBeNull();
  });
});

describe('readLinkPreview', () => {
  it('reads the title and picture of a public page', async () => {
    const fetcher = vi.fn(async () =>
      html(
        '<head><meta property="og:title" content="Campanha"><meta property="og:image" content="https://cdn.example.com/a.jpg"></head>',
      ),
    );

    const preview = await readLinkPreview('https://example.com/p', { fetcher, resolve: publicDns });

    expect(preview).toEqual({ title: 'Campanha', imageUrl: 'https://cdn.example.com/a.jpg' });
  });

  it.each([
    'http://example.com/p',
    'https://127.0.0.1/p',
    'https://[::1]/p',
    'https://2130706433/p',
    'https://localhost/p',
    'https://intranet/p',
    'https://example.com:8443/p',
    'https://user:pw@example.com/p',
    'https://db.internal/p',
  ])('never requests %s', async (link) => {
    const fetcher = vi.fn();

    const preview = await readLinkPreview(link, { fetcher, resolve: publicDns });

    expect(preview).toEqual({ title: null, imageUrl: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never requests a name that resolves to a private address', async () => {
    const fetcher = vi.fn();
    const privateDns: Resolver = async () => ['93.184.216.34', '10.0.0.5'];

    const preview = await readLinkPreview('https://rebind.example.com/p', {
      fetcher,
      resolve: privateDns,
    });

    expect(preview.title).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('checks a redirect target again, so a public page cannot bounce to a private one', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://internal.example.com/x' },
        }),
    );
    const dns: Resolver = async (host) =>
      host === 'internal.example.com' ? ['192.168.0.1'] : ['93.184.216.34'];

    const preview = await readLinkPreview('https://example.com/p', { fetcher, resolve: dns });

    expect(preview.title).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('follows a safe redirect, up to a few hops', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () =>
      calls++ < 1
        ? new Response(null, { status: 301, headers: { location: '/final' } })
        : html('<head><title>Destino</title></head>'),
    );

    expect(
      (await readLinkPreview('https://example.com/a', { fetcher, resolve: publicDns })).title,
    ).toBe('Destino');

    const loop = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: '/again' } }),
    );
    expect(
      (await readLinkPreview('https://example.com/a', { fetcher: loop, resolve: publicDns })).title,
    ).toBeNull();
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it('reads nothing from a page that is not HTML, or is too big', async () => {
    const json = vi.fn(
      async () => new Response('{"a":1}', { headers: { 'content-type': 'application/json' } }),
    );
    expect(
      (await readLinkPreview('https://example.com/p', { fetcher: json, resolve: publicDns })).title,
    ).toBeNull();

    const big = vi.fn(async () => html('<head><title>x</title></head>' + 'a'.repeat(300 * 1024)));
    expect(
      (await readLinkPreview('https://example.com/p', { fetcher: big, resolve: publicDns })).title,
    ).toBeNull();
  });

  it('gives an empty preview when the request fails', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network');
    });

    expect(await readLinkPreview('https://example.com/p', { fetcher, resolve: publicDns })).toEqual(
      {
        title: null,
        imageUrl: null,
      },
    );
  });
});

describe('readRemoteImage', () => {
  it('returns the bytes of a public image', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    );

    expect(
      await readRemoteImage('https://cdn.example.com/a.png', { fetcher, resolve: publicDns }),
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses a private host, a non-image and an oversized file', async () => {
    const never = vi.fn();
    expect(
      await readRemoteImage('https://10.0.0.1/a.png', { fetcher: never, resolve: publicDns }),
    ).toBeNull();
    expect(never).not.toHaveBeenCalled();

    const text = vi.fn(
      async () => new Response('hi', { headers: { 'content-type': 'text/html' } }),
    );
    expect(
      await readRemoteImage('https://cdn.example.com/a.png', { fetcher: text, resolve: publicDns }),
    ).toBeNull();

    const huge = vi.fn(
      async () =>
        new Response(new Uint8Array(3 * 1024 * 1024), { headers: { 'content-type': 'image/png' } }),
    );
    expect(
      await readRemoteImage('https://cdn.example.com/a.png', { fetcher: huge, resolve: publicDns }),
    ).toBeNull();
  });
});
