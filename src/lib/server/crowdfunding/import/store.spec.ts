import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, pgErrorCode } from '../../db/test-db';
import { crowdfundings, events, profiles, notifications } from '../../db/schema';
import { importCandidate, claimRun, finishRun } from './store';
import { addCrowdfunding, fileCrowdfundingReport, listCrowdfundings } from '../service';
import { listAdminCrowdfundings, removeCrowdfunding } from '../admin';
import { readCrowdfundingFilters } from '../../../crowdfunding/filters';
import { moderationHandler } from '../../events/moderation';
import { reportDetail } from '../../moderation/admin';
import type { SourceCandidate } from './types';
import type { Actor } from '../../auth/policy';
import type { StoredEvent } from '../../events/types';
let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-08T04:00:00Z');
const member: Actor = { id: crypto.randomUUID(), role: 'member', status: 'active' },
  admin: Actor = { id: crypto.randomUUID(), role: 'admin', status: 'active' };
const candidate = (key: string): SourceCandidate => ({
  source: 'catarse',
  externalId: key,
  url: `https://catarse.com.br/${key}`,
  name: 'Livro RPG',
  owner: 'Editora',
  startsOn: '2026-10-01',
  endsOn: '2026-11-01',
  imageUrl: null,
});
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: member.id, username: 'reader' },
    { id: admin.id, username: 'admin', role: 'admin' },
  ]);
});
afterAll(async () => {
  await test.close();
});
describe('automatic import persistence', () => {
  it('requires a source for imported entries and a member for member entries', async () => {
    const base = {
      url: 'https://catarse.com.br/invalid-origin',
      platform: 'catarse' as const,
      name: 'RPG',
      owner: 'Editora',
      startsOn: '2026-10-01',
      endsOn: '2026-11-01',
    };
    expect(
      await pgErrorCode(test.db.insert(crowdfundings).values({ ...base, origin: 'import' })),
    ).toBe('23514');
    expect(await pgErrorCode(test.db.insert(crowdfundings).values(base))).toBe('23514');
  });
  it('inserts once, with automatic credit in public and admin lists', async () => {
    const c = candidate('one');
    expect(await importCandidate(test.db, c, { now })).toBe('imported');
    expect(await importCandidate(test.db, c, { now })).toBe('existing');
    const list = await listCrowdfundings(test.db, readCrowdfundingFilters(new URLSearchParams()), {
      now,
    });
    expect(list?.running[0]).toMatchObject({ submitterId: null, importSource: 'catarse' });
    const page = await listAdminCrowdfundings(test.db, admin, new URLSearchParams());
    expect(page?.rows.some((r) => r.url === c.url)).toBe(true);
    expect(
      await test.db.select().from(events).where(eq(events.type, 'CrowdfundingImported')),
    ).toHaveLength(1);
  });
  it('preserves member credit across verified host aliases', async () => {
    const c = candidate('member');
    await addCrowdfunding(test.db, member, { ...c, url: 'https://catarse.me/member' }, { now });
    expect(await importCandidate(test.db, c, { now })).toBe('existing');
    const [row] = await test.db
      .select()
      .from(crowdfundings)
      .where(eq(crowdfundings.url, 'https://catarse.me/member'));
    expect(row.submitterId).toBe(member.id);
  });
  it('keeps removed campaigns suppressed, including changed slugs and manual entries', async () => {
    const c = candidate('removed');
    await importCandidate(test.db, c, { now });
    const [row] = await test.db.select().from(crowdfundings).where(eq(crowdfundings.url, c.url));
    await removeCrowdfunding(test.db, admin, row.id, { reason: 'off_topic', note: '' });
    expect(
      await importCandidate(test.db, { ...c, url: 'https://catarse.com.br/changed-slug' }, { now }),
    ).toBe('suppressed');
    const manual = candidate('manual-removed');
    await addCrowdfunding(
      test.db,
      member,
      { ...manual, url: 'https://catarse.me/manual-removed' },
      { now },
    );
    const [m] = await test.db
      .select()
      .from(crowdfundings)
      .where(eq(crowdfundings.url, 'https://catarse.me/manual-removed'));
    await removeCrowdfunding(test.db, admin, m.id, { reason: 'spam', note: '' });
    expect(await importCandidate(test.db, manual, { now })).toBe('suppressed');
  });
  it('allows reports and removal without notifying a null submitter', async () => {
    const c = candidate('reported');
    await importCandidate(test.db, c, { now });
    const [row] = await test.db.select().from(crowdfundings).where(eq(crowdfundings.url, c.url));
    const filed = await fileCrowdfundingReport(
      test.db,
      member,
      row.id,
      { reason: 'off_topic', details: '' },
      { now },
    );
    const [event] = await test.db.select().from(events).where(eq(events.id, filed.eventId));
    const detail = await reportDetail(
      test.db,
      admin,
      String((event.payload as { reportId: string }).reportId),
    );
    expect(detail?.crowdfunding?.submitter).toBeNull();
    const removed = await removeCrowdfunding(test.db, admin, row.id, {
      reason: 'off_topic',
      note: '',
    });
    for (const id of removed) {
      const [e] = await test.db.select().from(events).where(eq(events.id, id));
      await moderationHandler.handle({ ...e, attempts: 0 } as StoredEvent, test.db);
    }
    expect(await test.db.select().from(notifications)).toEqual([
      expect.objectContaining({ recipientId: member.id, type: 'report_resolved' }),
    ]);
  });
  it('leases once a day, reclaims expired work and fences old owners', async () => {
    const a = await claimRun(test.db, 'catarse', '2026-10-08', now);
    expect(a).not.toBeNull();
    expect(await claimRun(test.db, 'catarse', '2026-10-08', now)).toBeNull();
    const later = new Date(+now + 10 * 60_000);
    const b = await claimRun(test.db, 'catarse', '2026-10-08', later);
    expect(b).not.toBeNull();
    expect(await finishRun(test.db, a!, 'complete', null, {}, later)).toBe(false);
    expect(await finishRun(test.db, b!, 'complete', null, {}, later)).toBe(true);
    expect(await claimRun(test.db, 'catarse', '2026-10-08', later)).toBeNull();
  });
});
