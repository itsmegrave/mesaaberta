import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/http';
import { createQueryClient, retryRead } from './client';
import { readKey, readParams } from './keys';
import { afterWrite } from './invalidate';
describe('query cache boundaries', () => {
  it('isolates server clients and viewer-dependent detail/catalog keys', () => {
    const a = createQueryClient(),
      b = createQueryClient();
    for (const resource of [
      'detail',
      'manage',
      'dashboard',
      'account',
      'catalog',
      'editCatalog',
      'admin',
      'adminUsers',
      'adminTables',
    ] as const) {
      const key = readKey({ resource, viewer: 'ana', params: 'slug=mesa' });
      a.setQueryData(key, { secret: 'join link' });
      expect(b.getQueryData(key)).toBeUndefined();
      expect(
        a.getQueryData(readKey({ resource, viewer: 'bia', params: 'slug=mesa' })),
      ).toBeUndefined();
    }
    a.clear();
    b.clear();
  });
  it('deduplicates reordered multi-select filters without collapsing different single selections', () => {
    const params = (s: string) => readParams('tables', new URL('https://x.test/tables?' + s));
    expect(params('modality=online&modality=in_person')).toBe(params('modality=in_person'));
    expect(params('system=b&system=a&system=b')).toBe(params('system=a&system=b'));
    expect(params('modality=online&modality=in_person')).not.toBe(
      params('modality=in_person&modality=online'),
    );
  });
  it('invalidates every table view after a write, leaving unrelated lookups alone', async () => {
    const client = createQueryClient();
    const resources = [
      'tables',
      'preview',
      'detail',
      'dashboard',
      'manage',
      'catalog',
      'editCatalog',
      'cep',
      'username',
    ];
    for (const r of resources) client.setQueryData(['api', r], {});
    await afterWrite(client, 'table');
    for (const r of resources)
      expect(client.getQueryState(['api', r])?.isInvalidated).toBe(
        !['cep', 'username'].includes(r),
      );
    client.clear();
  });
  it('keys admin pages by normalized username, status and pagination filters', () => {
    const params = (query: string) =>
      readParams('adminUsers', new URL(`https://x.test/admin?${query}`));
    expect(params('q=ana&status=active&page=1')).not.toBe(params('q=ana&status=suspended&page=1'));
    expect(params('page=1')).not.toBe(params('page=2'));
    expect(params('size=20')).not.toBe(params('size=50'));
    expect(params('q=%20ana%20&status=invalid&page=-5&size=bad')).toBe(params('q=ana'));
  });
  it('clears all private data on logout and never retries denied reads or writes', () => {
    const client = createQueryClient();
    client.setQueryData(['api', 'account', 'ana'], { name: 'Ana' });
    client.clear();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(retryRead(0, new ApiError(403))).toBe(false);
    expect(retryRead(0, new ApiError(429))).toBe(false);
    expect(retryRead(0, new ApiError(503))).toBe(true);
    expect(retryRead(2, new ApiError(503))).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
