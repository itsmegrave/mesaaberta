import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'devalue';
import { readers, loadRead } from '$lib/server/reads/load';
import { GET } from './+server';
const event = (resource: string, viewer: string | null = 'ana', query = '') =>
  ({
    params: { resource },
    url: new URL('https://x.test/api/query/' + resource + query),
    locals: {
      db: null,
      getUser: async () => (viewer ? { id: viewer } : null),
      getProfile: async () => null,
    },
    platform: undefined,
  }) as unknown as RequestEvent;
beforeEach(() => vi.restoreAllMocks());
describe('query endpoint and loader', () => {
  it('shares the sanitized public DTO between loader and API with a no-store response', async () => {
    const e = event('preview');
    const loaded = await loadRead(e, 'preview');
    const response = await GET(e as Parameters<typeof GET>[0]);
    expect(parse(await response.text())).toEqual({ tables: [] });
    expect(loaded.readSeed).toMatchObject({
      resource: 'preview',
      viewer: 'public',
      fields: ['tables'],
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('never selects an identity from the caller query string', async () => {
    const response = await GET(event('account', 'ana', '?viewer=bia') as Parameters<typeof GET>[0]);
    expect(response.headers.get('x-query-viewer')).toBe('ana');
  });
  it('does not expose an arbitrary service or accept a missing table slug', async () => {
    await expect(GET(event('secrets') as Parameters<typeof GET>[0])).rejects.toMatchObject({
      status: 404,
    });
    await expect(GET(event('manage') as Parameters<typeof GET>[0])).rejects.toMatchObject({
      status: 400,
    });
  });
  it('rechecks authentication on private refetches', async () => {
    await expect(GET(event('dashboard', null) as Parameters<typeof GET>[0])).rejects.toMatchObject({
      status: 401,
    });
  });
  it('propagates policy denial and passes only the requested slug to the authorized reader', async () => {
    vi.spyOn(readers, 'manage').mockRejectedValue({ status: 403 });
    await expect(
      GET(event('manage', 'ana', '?slug=mesa') as Parameters<typeof GET>[0]),
    ).rejects.toMatchObject({ status: 403 });
    expect(readers.manage).toHaveBeenCalledWith(
      expect.objectContaining({ params: { resource: 'manage', slug: 'mesa' } }),
    );
  });
});
