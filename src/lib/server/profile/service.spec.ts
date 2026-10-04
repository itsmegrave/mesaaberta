import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profileSocialLinks, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Invalid, NotFound } from '../errors';
import { isUsernameAvailable, loadProfileForm, saveProfile } from './service';
import type { ProfileInput } from '$lib/profile/schema';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`;

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([{ id: id(1) }, { id: id(2) }, { id: id(3), username: 'bruno' }, { id: id(4) }]);
});
afterAll(() => test.close());

const input = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  username: 'ana',
  name: '',
  ageRange: '',
  gender: '',
  genderOther: '',
  city: '',
  timezone: '',
  linkNetwork: [],
  linkUrl: [],
  ...over,
});

describe('saveProfile', () => {
  it('stores the username alone, blanks as nothing', async () => {
    await saveProfile(test.db, id(1), input({ username: 'ana' }));

    const [profile] = await test.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id(1)));
    expect(profile).toMatchObject({
      username: 'ana',
      name: null,
      ageRange: null,
      gender: null,
      genderOther: null,
      city: null,
    });
  });

  it('stores the details and the links in the order sent, and a later save replaces them', async () => {
    await saveProfile(
      test.db,
      id(2),
      input({
        username: 'carla',
        name: 'Carla Dias',
        ageRange: '25_34',
        gender: 'woman',
        city: 'Recife',
        timezone: 'America/Recife',
        linkNetwork: ['instagram', 'website', 'x'],
        linkUrl: ['instagram.com/carla', '', 'https://x.com/carla'],
      }),
    );

    expect(await loadProfileForm(test.db, id(2))).toEqual({
      username: 'carla',
      name: 'Carla Dias',
      ageRange: '25_34',
      gender: 'woman',
      genderOther: '',
      city: 'Recife',
      timezone: 'America/Recife',
      linkNetwork: ['instagram', 'x'],
      linkUrl: ['carla', 'carla'],
    });

    await saveProfile(
      test.db,
      id(2),
      input({ username: 'carla', linkNetwork: ['x'], linkUrl: ['https://x.com/carla2'] }),
    );

    const links = await test.db
      .select()
      .from(profileSocialLinks)
      .where(eq(profileSocialLinks.profileId, id(2)));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      network: 'x',
      handle: 'carla2',
      url: 'https://x.com/carla2',
      position: 0,
    });
  });

  it('keeps the own words with "Outro" only, and forgets them when another option is picked', async () => {
    await saveProfile(test.db, id(1), input({ gender: 'other', genderOther: 'demigênero' }));
    expect(await loadProfileForm(test.db, id(1))).toMatchObject({
      gender: 'other',
      genderOther: 'demigênero',
    });

    await saveProfile(test.db, id(1), input({ gender: 'agender', genderOther: 'demigênero' }));
    const [profile] = await test.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id(1)));
    expect(profile).toMatchObject({ gender: 'agender', genderOther: null });
  });

  it('says the username is taken, whatever its case, and leaves the profile as it was', async () => {
    await expect(
      saveProfile(test.db, id(1), input({ username: 'BRUNO', name: 'Nova' })),
    ).rejects.toEqual(
      expect.objectContaining({ name: 'Invalid', field: 'username', message: 'taken' }),
    );

    const [profile] = await test.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id(1)));
    expect(profile).toMatchObject({ username: 'ana', name: null });
  });

  it('lets someone keep their own username while changing something else', async () => {
    await saveProfile(test.db, id(1), input({ username: 'ana', city: 'Natal' }));

    const [profile] = await test.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id(1)));
    expect(profile).toMatchObject({ username: 'ana', city: 'Natal' });
  });

  it('refuses a profile that does not exist', async () => {
    await expect(saveProfile(test.db, id(99), input())).rejects.toBeInstanceOf(NotFound);
  });

  it('is not an Invalid error for anything but the username', async () => {
    await expect(
      saveProfile(test.db, id(1), input({ username: '-bad' })),
    ).rejects.not.toBeInstanceOf(Invalid);
  });
});

describe('the history of a save', () => {
  const logged = async (profileId: string) =>
    (await test.db.select().from(events).where(eq(events.type, 'ProfileUpdated')))
      .filter((event) => (event.payload as { profileId: string }).profileId === profileId)
      .map((event) => ({ actorId: event.actorId, changes: (event.payload as never)['changes'] }));

  it('records who changed what, by themselves, with the old and the new username', async () => {
    await saveProfile(test.db, id(4), input({ username: 'historia-a' }));
    await saveProfile(
      test.db,
      id(4),
      input({ username: 'historia-b', timezone: 'America/Recife' }),
    );

    expect(await logged(id(4))).toEqual([
      { actorId: id(4), changes: { username: { from: null, to: 'historia-a' } } },
      {
        actorId: id(4),
        changes: {
          username: { from: 'historia-a', to: 'historia-b' },
          timezone: { from: null, to: 'America/Recife' },
        },
      },
    ]);
  });

  it('says that personal details changed, and never what they became', async () => {
    await saveProfile(
      test.db,
      id(4),
      input({
        username: 'historia-b',
        timezone: 'America/Recife',
        name: 'Carla Souza',
        city: 'Recife',
        gender: 'other',
        genderOther: 'agênero',
        ageRange: '25_34',
      }),
    );

    const last = (await logged(id(4))).at(-1)!;
    expect(last.changes).toEqual({
      name: { redacted: true },
      city: { redacted: true },
      gender: { redacted: true },
      genderOther: { redacted: true },
      ageRange: { redacted: true },
    });
    for (const secret of ['Carla Souza', 'Recife', 'agênero', '25_34'])
      expect(JSON.stringify(last)).not.toContain(secret);
  });

  it('lists the links that were added or taken off, and logs nothing for a save that changes nothing', async () => {
    await saveProfile(
      test.db,
      id(4),
      input({
        username: 'historia-b',
        timezone: 'America/Recife',
        name: 'Carla Souza',
        city: 'Recife',
        gender: 'other',
        genderOther: 'agênero',
        ageRange: '25_34',
        linkNetwork: ['instagram'],
        linkUrl: ['https://instagram.com/carla'],
      }),
    );
    const count = (await logged(id(4))).length;

    expect((await logged(id(4))).at(-1)!.changes).toEqual({
      links: { from: null, to: 'instagram: carla' },
    });

    await saveProfile(
      test.db,
      id(4),
      input({
        username: 'historia-b',
        timezone: 'America/Recife',
        name: 'Carla Souza',
        city: 'Recife',
        gender: 'other',
        genderOther: 'agênero',
        ageRange: '25_34',
        linkNetwork: ['instagram'],
        linkUrl: ['https://instagram.com/carla'],
      }),
    );
    expect((await logged(id(4))).length).toBe(count);
  });
});

describe('isUsernameAvailable', () => {
  it('is false for a taken username, whatever its case, and true for a free one', async () => {
    expect(await isUsernameAvailable(test.db, 'bruno')).toBe(false);
    expect(await isUsernameAvailable(test.db, ' Bruno ')).toBe(false);
    expect(await isUsernameAvailable(test.db, 'livre')).toBe(true);
  });

  it("does not count the person's own username as taken", async () => {
    expect(await isUsernameAvailable(test.db, 'bruno', { exceptProfileId: id(3) })).toBe(true);
  });
});

describe('loadProfileForm', () => {
  it('is null for a profile that does not exist, and empty text for what was never filled', async () => {
    expect(await loadProfileForm(test.db, id(98))).toBeNull();
    expect(await loadProfileForm(test.db, id(3))).toMatchObject({
      username: 'bruno',
      name: '',
      ageRange: '',
      linkNetwork: [],
    });
  });
});
