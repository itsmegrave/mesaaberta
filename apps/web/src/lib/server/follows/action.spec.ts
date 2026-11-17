import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { follows, gameTables, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { apiOver } from '../db/test-api';
import { followAction } from './action';
import { followState, gmFollowState } from './state';

const gm = '00000000-0000-4000-8000-000000000f21';
const ana = '00000000-0000-4000-8000-000000000f22';
let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: ana, username: 'ana' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    slug: 'mesa',
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 3,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: gm,
    systemId: system.id,
  } as never);
});
afterAll(() => test.close());

// The api Worker follows and reads over the test database; `use_follows` is on.
const localsOf = (id: string | null) =>
  ({
    env: apiOver(test.db),
    log: { warn: vi.fn() },
    flags: { isEnabled: async () => true },
    afterResponse: vi.fn(),
    getUser: async () => (id ? { id } : null),
    getProfile: async () => (id ? { id, username: 'x', role: 'member', status: 'active' } : null),
  }) as unknown as App.Locals;
const post = (locals: App.Locals, form: Record<string, string>) =>
  followAction({
    locals,
    url: new URL('https://x.test/u/mestre'),
    request: new Request('https://x.test/u/mestre', {
      method: 'POST',
      body: new URLSearchParams(form),
    }),
  });

describe('the Seguir button', () => {
  it('follows through the api, which delivers the event', async () => {
    const locals = localsOf(ana);
    await post(locals, { profileId: gm, follow: 'true' });
    expect(await test.db.select().from(follows)).toMatchObject([
      { followerId: ana, followeeId: gm },
    ]);
    expect(locals.afterResponse).not.toHaveBeenCalled();
    expect(await followState(locals, gm)).toEqual({
      profileId: gm,
      signedIn: true,
      following: true,
    });
  });

  it('shows the GM row of a table, with no button for the GM', async () => {
    expect(await gmFollowState(localsOf(ana), 'mesa')).toEqual({
      profileId: gm,
      signedIn: true,
      following: true,
    });
    expect(await gmFollowState(localsOf(null), 'mesa')).toEqual({
      profileId: gm,
      signedIn: false,
      following: false,
    });
    expect(await gmFollowState(localsOf(gm), 'mesa')).toBeNull();
  });

  it('stops following through the api', async () => {
    await post(localsOf(ana), { profileId: gm, follow: 'false' });
    expect(await test.db.select().from(follows)).toEqual([]);
  });
});
