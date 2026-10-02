import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import { publicProfile } from '$lib/server/profile/public';

vi.mock('$lib/server/profile/public', () => ({ publicProfile: vi.fn() }));
vi.mock('$lib/paraglide/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/paraglide/runtime')>()),
  getLocale: () => 'pt-BR',
}));

const result = { profile: { username: 'ana' }, page: 1, pages: 1, isOwner: false };
const run = (username = 'ana', query = '', db: object | null = {}) => {
  const setHeaders = vi.fn();
  const event = {
    locals: { db, getUser: async () => null },
    params: { username },
    platform: undefined,
    setHeaders,
    url: new URL(`https://mesaaberta.app/${username}${query}`),
  };
  return { promise: load(event as unknown as Parameters<typeof load>[0]), setHeaders };
};

beforeEach(() => {
  vi.mocked(publicProfile)
    .mockReset()
    .mockResolvedValue(result as unknown as NonNullable<Awaited<ReturnType<typeof publicProfile>>>);
});

describe('the public profile route', () => {
  it('works without authentication and keeps the personalized HTML out of shared caches', async () => {
    const { promise, setHeaders } = run();
    await expect(promise).resolves.toMatchObject({
      ...result,
      canonical: 'https://mesaaberta.app/u/ana',
    });
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
    expect(publicProfile).toHaveBeenCalledWith(
      {},
      'ana',
      expect.objectContaining({ viewerId: undefined, page: 1 }),
    );
  });
  it('redirects capitalization while preserving pagination', async () => {
    await expect(run('Ana', '?page=1').promise).rejects.toMatchObject({
      status: 308,
      location: '/u/ana?page=1',
    });
  });
  it('returns 404 for an unavailable profile', async () => {
    vi.mocked(publicProfile).mockResolvedValue(null);
    await expect(run().promise).rejects.toMatchObject({ status: 404 });
  });
  it('returns 404 beyond the last page', async () => {
    vi.mocked(publicProfile).mockResolvedValue({ ...result, page: 2 } as unknown as NonNullable<
      Awaited<ReturnType<typeof publicProfile>>
    >);
    await expect(run('ana', '?page=2').promise).rejects.toMatchObject({ status: 404 });
  });
  it('does not turn database failures into a misleading 404', async () => {
    vi.mocked(publicProfile).mockRejectedValue(new Error('Database unavailable'));
    await expect(run().promise).rejects.toThrow('Database unavailable');
    await expect(run('ana', '', null).promise).rejects.toMatchObject({ status: 503 });
  });
});
