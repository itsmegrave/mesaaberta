import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profiles, systemLogos, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../../../apps/web/src/lib/server/db/test-db';
import {
  approveLogo,
  approveSureLogos,
  forgetLogo,
  listSystemLogos,
  recordLogoSearch,
  rejectLogo,
  systemsToSearch,
  uploadLogo,
} from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = {
  id: '00000000-0000-4000-8000-000000007101',
  role: 'admin',
  status: 'active',
} as const;
const member = { ...admin, id: '00000000-0000-4000-8000-000000007102', role: 'member' } as const;
let ids: Record<string, string>;

const found = (path: string, confidence: 'high' | 'medium' | 'low' = 'high') => ({
  path,
  method: 'wikidata' as const,
  confidence,
  imageUrl: 'https://upload.wikimedia.org/x.png',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:X.svg',
  attribution: 'Editora',
  license: 'Public domain',
  note: null,
  wikidataId: 'Q1',
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.delete(systems);
  await test.db.insert(profiles).values([
    { id: admin.id, username: 'admin', role: 'admin' },
    { id: member.id, username: 'membro' },
  ]);
  const rows = await test.db
    .insert(systems)
    .values([
      { name: 'Daggerheart', slug: 'daggerheart', position: 2 },
      { name: 'Dungeons & Dragons 5e', slug: 'dnd', position: 1 },
      { name: 'Sistema Caseiro', slug: 'caseiro', position: 3 },
      { name: 'Sugestão', slug: 'sugestao', status: 'pending' },
    ])
    .returning({ id: systems.id, slug: systems.slug });
  ids = Object.fromEntries(rows.map((row) => [row.slug, row.id]));
});

afterAll(() => test?.close());

describe('system logos', () => {
  it('lets only admins in', async () => {
    await expect(systemsToSearch(test.db, member)).rejects.toThrow();
  });

  it('searches approved systems without a row, most played first, and records what it found', async () => {
    expect((await systemsToSearch(test.db, admin, 10)).map((s) => s.slug)).toEqual([
      'dnd',
      'daggerheart',
      'caseiro',
    ]);

    await recordLogoSearch(test.db, admin, {
      systemId: ids.dnd,
      found: found('systems/dnd.png', 'medium'),
      reason: null,
      wikidataId: 'Q1',
    });
    await recordLogoSearch(test.db, admin, {
      systemId: ids.daggerheart,
      found: found('systems/dh.png'),
      reason: null,
      wikidataId: 'Q2',
    });
    await recordLogoSearch(test.db, admin, {
      systemId: ids.caseiro,
      found: null,
      reason: 'no_wikidata_item',
      wikidataId: null,
    });

    expect(await systemsToSearch(test.db, admin, 10)).toEqual([]);
    const pending = await listSystemLogos(test.db, admin, { status: 'pending', page: 1 });
    expect(pending?.counts).toEqual({ pending: 2, approved: 0, rejected: 0, missing: 1 });
    expect(pending?.unsearched).toBe(0);
    // The surest first.
    expect(pending?.logos.map((l) => l.slug)).toEqual(['daggerheart', 'dnd']);
    expect(await listSystemLogos(test.db, admin, { status: 'pending', page: 2 })).toBeNull();
  });

  it('keeps the first find when two searches race, and hands back the unused file', async () => {
    expect(
      await recordLogoSearch(test.db, admin, {
        systemId: ids.daggerheart,
        found: found('systems/other.png'),
        reason: null,
        wikidataId: 'Q2',
      }),
    ).toEqual({ unused: 'systems/other.png' });
  });

  it('approves the sure ones in one go, then one by one, and rejects with the file to delete', async () => {
    expect(await approveSureLogos(test.db, admin)).toEqual({ approved: 1 });
    await approveLogo(test.db, admin, ids.dnd);
    await expect(approveLogo(test.db, admin, ids.dnd)).rejects.toThrow();

    expect(await rejectLogo(test.db, admin, ids.dnd)).toEqual({ removed: 'systems/dnd.png' });
    const [row] = await test.db.select().from(systemLogos).where(eq(systemLogos.systemId, ids.dnd));
    expect(row).toMatchObject({ status: 'rejected', path: null, reviewedBy: admin.id });
  });

  it('takes an upload as approved, answers the file it replaced, and refuses a foreign path', async () => {
    expect(
      await uploadLogo(test.db, admin, {
        systemId: ids.dnd,
        path: 'systems/mine.png',
        sourcePage: 'https://dnd.wizards.com/',
        attribution: 'Wizards of the Coast',
      }),
    ).toEqual({ replaced: null });
    const [row] = await test.db.select().from(systemLogos).where(eq(systemLogos.systemId, ids.dnd));
    expect(row).toMatchObject({ status: 'approved', method: 'upload', path: 'systems/mine.png' });
    expect(
      await uploadLogo(test.db, admin, {
        systemId: ids.dnd,
        path: 'systems/again.png',
        sourcePage: 'https://dnd.wizards.com/',
        attribution: null,
      }),
    ).toEqual({ replaced: 'systems/mine.png' });
    await expect(
      uploadLogo(test.db, admin, {
        systemId: ids.dnd,
        path: 'tables/../x.png',
        sourcePage: 'https://x.com/',
        attribution: null,
      }),
    ).rejects.toThrow();
  });

  it('forgets a system, so the next search looks at it again', async () => {
    expect(await forgetLogo(test.db, admin, ids.daggerheart)).toEqual({
      removed: 'systems/dh.png',
    });
    expect((await systemsToSearch(test.db, admin)).map((s) => s.slug)).toEqual(['daggerheart']);
  });
});
