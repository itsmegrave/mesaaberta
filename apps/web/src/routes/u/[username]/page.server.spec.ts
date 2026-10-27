import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';
import { callApiRaw } from '#lib/server/api-client.js';

vi.mock('#lib/server/api-client.js', () => ({ callApiRaw: vi.fn() }));
vi.mock('#lib/paraglide/runtime.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#lib/paraglide/runtime.js')>()),
  getLocale: () => 'pt-BR',
}));

const subject = { id: 'p1', isAdmin: false };
const body = (extra: Record<string, unknown> = {}) => ({
  subject,
  follows: { following: true, followers: 7 },
  badges: [{ slug: 'first' }],
  profile: {
    username: 'ana',
    participantRating: { score: 4, count: 3, isNew: false },
    favoriteSystems: [{ name: 'D&D', slug: 'dnd' }],
    tableRole: 'gm',
  },
  tables: [{ slug: 't', startsAt: '2026-11-01T20:00:00.000Z' }],
  reviews: [{ text: 'boa', createdAt: '2026-10-01T20:00:00.000Z' }],
  page: 1,
  pages: 1,
  total: 1,
  isOwner: false,
  ...extra,
});
const answer = (value: unknown, status = 200) =>
  vi.mocked(callApiRaw).mockResolvedValue({ ok: status < 400, status, body: value });

const isEnabled = vi.fn(async (_name: string, _target?: unknown) => true);
const run = (
  username = 'ana',
  query = '',
  { user = null as { id: string } | null, profile = null as object | null } = {},
) => {
  const setHeaders = vi.fn();
  const event = {
    locals: {
      env: { APP_ORIGIN: 'https://mesaaberta.app' },
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
      getUser: async () => user,
      getProfile: async () => profile,
      flags: { isEnabled },
    },
    params: { username },
    platform: undefined,
    setHeaders,
    url: new URL(`https://untrusted.example/u/${username}${query}`),
  };
  return { promise: load(event as unknown as Parameters<typeof load>[0]), setHeaders };
};

type Loaded = Exclude<Awaited<ReturnType<typeof load>>, void>;
const loaded = async (...args: Parameters<typeof run>) => (await run(...args).promise) as Loaded;

beforeEach(() => {
  isEnabled.mockReset().mockResolvedValue(true);
  answer(body());
});

describe('the public profile route', () => {
  it('reads the page from the api, as a visitor, and keeps it out of shared caches', async () => {
    const { promise, setHeaders } = run();
    const data = (await promise) as Record<string, unknown>;
    expect(data).toMatchObject({ canonical: 'https://mesaaberta.app/u/ana', isOwner: false });
    expect(data).not.toHaveProperty('subject');
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
    expect(callApiRaw).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/profiles/ana',
      null,
      expect.anything(),
      undefined,
      {},
      'GET',
    );
  });
  it('names the signed-in viewer and passes the page on', async () => {
    answer(body({ page: 2, pages: 2 }));
    await run('ana', '?page=2', { user: { id: 'v1' } }).promise;
    expect(vi.mocked(callApiRaw).mock.calls[0].slice(1, 3)).toEqual([
      '/v1/profiles/ana?page=2',
      'v1',
    ]);
  });
  it('turns the dates back into dates', async () => {
    const data = await loaded();
    expect(data.tables[0].startsAt).toBeInstanceOf(Date);
    expect(data.reviews[0].createdAt).toBeInstanceOf(Date);
  });
  it('shares the actual profile page without visitor or tracking parameters', async () => {
    answer(body({ page: 2, pages: 2 }));
    await expect(run('ana', '?page=2&as=visitor&utm_source=share').promise).resolves.toMatchObject({
      canonical: 'https://mesaaberta.app/u/ana?page=2',
    });
  });
  it('asks the rollouts about the profile being shown and drops what is off', async () => {
    isEnabled.mockImplementation(async (name) => name === 'use_badges');
    const data = await loaded();
    expect(isEnabled).toHaveBeenCalledWith('use_badges', subject);
    expect(isEnabled).toHaveBeenCalledWith('use_player_ratings', subject);
    expect(isEnabled).toHaveBeenCalledWith('use_signed_in_home', subject);
    expect(data.badges).toEqual([{ slug: 'first' }]);
    expect(data.profile).toMatchObject({
      participantRating: null,
      favoriteSystems: null,
      tableRole: null,
    });
    expect(data.follow).toBeNull();
  });
  it('offers Seguir to anyone else and the follower count only to the owner', async () => {
    const viewer = { id: 'v1', role: 'player', status: 'active' };
    await expect(
      run('ana', '', { user: { id: 'v1' }, profile: viewer }).promise,
    ).resolves.toMatchObject({
      follow: { profileId: 'p1', signedIn: true, following: true },
      followers: null,
    });
    answer(body({ isOwner: true }));
    const owner = { id: 'p1', role: 'player', status: 'active' };
    await expect(
      run('ana', '', { user: { id: 'p1' }, profile: owner }).promise,
    ).resolves.toMatchObject({ follow: null, followers: 7 });
  });
  it('shows the owner the page as a visitor sees it with ?as=visitor, and only the owner', async () => {
    answer(body({ isOwner: true }));
    await expect(run('ana', '?as=visitor').promise).resolves.toMatchObject({
      isOwner: false,
      previewing: true,
      followers: null,
    });
    answer(body());
    await expect(run('ana', '?as=visitor').promise).resolves.toMatchObject({ previewing: false });
  });
  it('redirects capitalization while preserving pagination', async () => {
    await expect(run('Ana', '?page=1').promise).rejects.toMatchObject({
      status: 308,
      location: '/u/ana?page=1',
    });
  });
  it('answers 404 when the api finds no such profile or page', async () => {
    answer({ error: 'not_found' }, 404);
    await expect(run().promise).rejects.toMatchObject({ status: 404 });
  });
  it('does not turn an api failure into a misleading 404', async () => {
    answer({ error: 'internal_error' }, 500);
    await expect(run().promise).rejects.toMatchObject({ status: 503 });
    vi.mocked(callApiRaw).mockResolvedValue(null);
    await expect(run().promise).rejects.toMatchObject({ status: 503 });
  });
});
