import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { readCrowdfundingFilters } from '$lib/crowdfunding/filters';
import type { Actor } from '../auth/policy';
import { crowdfundings, events, notifications, profiles, reports } from '../db/schema';
import { createTestDb, pgErrorCode } from '../db/test-db';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { moderationHandler } from '../events/moderation';
import type { StoredEvent } from '../events/types';
import { listReports, reportDetail } from '../moderation/admin';
import { listAdminCrowdfundings, removeCrowdfunding } from './admin';
import {
  addCrowdfunding,
  fileCrowdfundingReport,
  findListedByUrl,
  listCrowdfundings,
  takeLinkRead,
} from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-10T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);

const input = (over: Partial<Parameters<typeof addCrowdfunding>[2]> = {}) => ({
  url: 'https://www.catarse.me/meu-rpg/?utm_source=x',
  name: 'Meu RPG',
  owner: 'Estúdio Dragão',
  startsOn: '2026-10-05',
  endsOn: '2026-10-25',
  ...over,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(3), username: 'carla' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(reports);
  await test.db.delete(crowdfundings);
  await test.db.delete(events);
});

const filters = (query = '') => readCrowdfundingFilters(new URLSearchParams(query));
const stored = async (eventId: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
  return { ...row, attempts: 0 } as unknown as StoredEvent;
};

describe('addCrowdfunding', () => {
  it('lists a campaign at once, by its canonical link and the platform of its host', async () => {
    await addCrowdfunding(test.db, ana, input(), { now });

    const [row] = await test.db.select().from(crowdfundings);
    expect(row).toMatchObject({
      url: 'https://catarse.me/meu-rpg',
      platform: 'catarse',
      submitterId: ana.id,
      removedAt: null,
    });
    const list = await listCrowdfundings(test.db, filters(), { now });
    expect(list?.running.map((card) => card.name)).toEqual(['Meu RPG']);
    expect(list?.running[0].submitter).toBe('ana');
  });

  it('refuses the same link shared again however it is written, and points at the first', async () => {
    await addCrowdfunding(test.db, ana, input(), { now });

    await expect(
      addCrowdfunding(test.db, bruno, input({ url: 'https://catarse.me./meu-rpg#top' }), { now }),
    ).rejects.toMatchObject({ field: 'url', message: 'already_listed' });
    expect(await findListedByUrl(test.db, 'https://CATARSE.me/meu-rpg/')).toMatchObject({
      name: 'Meu RPG',
    });
  });

  it('accepts the link again once the first was removed', async () => {
    const { id: first } = await addCrowdfunding(test.db, ana, input(), { now });
    await removeCrowdfunding(test.db, admin, first, { reason: 'spam', note: '' }, { now });

    await expect(addCrowdfunding(test.db, bruno, input(), { now })).resolves.toBeTruthy();
  });

  it('refuses a link that is not https, dates out of order and a signed-out visitor', async () => {
    await expect(
      addCrowdfunding(test.db, ana, input({ url: 'http://catarse.me/x' }), { now }),
    ).rejects.toBeInstanceOf(Invalid);
    await expect(
      addCrowdfunding(test.db, ana, input({ endsOn: '2026-10-01' }), { now }),
    ).rejects.toMatchObject({ field: 'endsOn' });
    await expect(addCrowdfunding(test.db, null, input(), { now })).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it('limits how many a member adds in a day, and a refusal wrote nothing', async () => {
    for (let n = 0; n < 5; n++) {
      await addCrowdfunding(test.db, ana, input({ url: `https://catarse.me/p${n}` }), { now });
    }

    await expect(
      addCrowdfunding(test.db, ana, input({ url: 'https://catarse.me/p5' }), { now }),
    ).rejects.toBeInstanceOf(RateLimited);
    expect(await test.db.select().from(crowdfundings)).toHaveLength(5);
  });

  it('is held to the database too: dates out of order and an empty name are rejected', async () => {
    const row = {
      submitterId: ana.id,
      url: 'https://x.example/a',
      platform: 'other' as const,
      name: 'x',
      owner: 'y',
      startsOn: '2026-10-05',
      endsOn: '2026-10-01',
    };
    expect(await pgErrorCode(test.db.insert(crowdfundings).values(row))).toBe('23514');
    expect(
      await pgErrorCode(
        test.db.insert(crowdfundings).values({ ...row, endsOn: '2026-10-06', name: '' }),
      ),
    ).toBe('23514');
  });
});

describe('listCrowdfundings', () => {
  beforeEach(async () => {
    await addCrowdfunding(
      test.db,
      ana,
      input({ url: 'https://catarse.me/a', name: 'Termina logo', endsOn: '2026-10-12' }),
      { now },
    );
    await addCrowdfunding(
      test.db,
      ana,
      input({ url: 'https://www.kickstarter.com/b', name: 'Termina depois', endsOn: '2026-11-20' }),
      { now },
    );
    await addCrowdfunding(
      test.db,
      ana,
      input({
        url: 'https://gamefound.com/c',
        name: 'Em breve',
        startsOn: '2026-10-20',
        endsOn: '2026-11-30',
      }),
      { now },
    );
    await addCrowdfunding(
      test.db,
      bruno,
      input({
        url: 'https://example.com/d',
        name: 'Já acabou',
        startsOn: '2026-09-01',
        endsOn: '2026-10-01',
      }),
      { now },
    );
  });

  it('shows what is running with the one ending soonest first, what opens soon, and counts the ended', async () => {
    const list = await listCrowdfundings(test.db, filters(), { now });

    expect(list?.running.map((card) => card.name)).toEqual(['Termina logo', 'Termina depois']);
    expect(list?.upcoming.map((card) => card.name)).toEqual(['Em breve']);
    expect(list?.endedCount).toBe(1);
    expect(list?.ended).toEqual([]);
  });

  it('lists the ended ones on their own page, and answers null past the last page', async () => {
    const ended = await listCrowdfundings(test.db, filters('status=ended'), { now });

    expect(ended?.ended.map((card) => card.name)).toEqual(['Já acabou']);
    expect(await listCrowdfundings(test.db, filters('status=ended&page=2'), { now })).toBeNull();
  });

  it('ignores removed platform controls and keeps search by campaign name or owner', async () => {
    const byPlatform = await listCrowdfundings(test.db, filters('platform=kickstarter'), { now });
    expect(byPlatform?.running.map((card) => card.name)).toEqual([
      'Termina logo',
      'Termina depois',
    ]);
    expect(byPlatform?.upcoming.map((card) => card.name)).toEqual(['Em breve']);

    const search = await listCrowdfundings(test.db, filters('q=termina'), { now });
    expect(search?.running).toHaveLength(2);
    const byOwner = await listCrowdfundings(test.db, filters('q=drag%C3%A3o'), { now });
    expect(byOwner?.running.length).toBeGreaterThan(0);
  });

  it('treats % and _ in a search as plain text', async () => {
    const list = await listCrowdfundings(test.db, filters('q=%25'), { now });

    expect(list?.running).toEqual([]);
  });

  it('never lists a removed campaign', async () => {
    const [target] = await test.db
      .select()
      .from(crowdfundings)
      .where(eq(crowdfundings.name, 'Termina logo'));
    await removeCrowdfunding(test.db, admin, target.id, { reason: 'scam', note: '' }, { now });

    const list = await listCrowdfundings(test.db, filters(), { now });
    expect(list?.running.map((card) => card.name)).toEqual(['Termina depois']);
  });
});

describe('fileCrowdfundingReport', () => {
  const report = { reason: 'scam' as const, details: 'Parece golpe.' };

  it('files an anonymous report with no table, and records the event', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });

    const { eventId } = await fileCrowdfundingReport(test.db, bruno, campaign, report, { now });

    const [row] = await test.db.select().from(reports);
    expect(row).toMatchObject({
      targetType: 'crowdfunding',
      targetId: campaign,
      tableId: null,
      reporterId: bruno.id,
      reason: 'scam',
    });
    expect((await stored(eventId)).type).toBe('ReportFiled');
  });

  it("refuses one's own campaign, a repeat while one waits, and a campaign that is not up", async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });

    await expect(
      fileCrowdfundingReport(test.db, ana, campaign, report, { now }),
    ).rejects.toBeInstanceOf(Forbidden);
    await fileCrowdfundingReport(test.db, bruno, campaign, report, { now });
    await expect(
      fileCrowdfundingReport(test.db, bruno, campaign, report, { now }),
    ).rejects.toMatchObject({
      message: 'already_reported',
    });
    await expect(
      fileCrowdfundingReport(test.db, bruno, crypto.randomUUID(), report, { now }),
    ).rejects.toBeInstanceOf(NotFound);
    await removeCrowdfunding(test.db, admin, campaign, { reason: 'scam', note: '' }, { now });
    await expect(
      fileCrowdfundingReport(test.db, member(3), campaign, report, { now }),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('is database-checked: a table report cannot lose its table', async () => {
    expect(
      await pgErrorCode(
        test.db.insert(reports).values({
          reporterId: ana.id,
          targetType: 'table',
          targetId: crypto.randomUUID(),
          tableId: null,
          reason: 'spam',
        }),
      ),
    ).toBe('23514');
  });
});

describe('the admin queue', () => {
  it('lists a crowdfunding report, which has no table, with the campaign it is about', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });
    await fileCrowdfundingReport(
      test.db,
      bruno,
      campaign,
      { reason: 'broken_link', details: '' },
      { now },
    );

    const queue = await listReports(test.db, admin, new URLSearchParams());

    expect(queue?.rows).toHaveLength(1);
    expect(queue?.rows[0]).toMatchObject({
      targetType: 'crowdfunding',
      crowdfunding: 'Meu RPG',
      table: null,
      reporter: 'bruno',
    });
    expect(queue?.counts.waiting).toBe(1);
  });

  it('opens its detail with the campaign, its submitter and the removal on offer', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });
    await fileCrowdfundingReport(
      test.db,
      bruno,
      campaign,
      { reason: 'spam', details: '' },
      { now },
    );
    const [row] = await test.db.select().from(reports);

    const detail = await reportDetail(test.db, admin, row.id);

    expect(detail?.table).toBeNull();
    expect(detail?.crowdfunding).toMatchObject({ name: 'Meu RPG', submitter: { username: 'ana' } });
    expect(detail?.can).toMatchObject({ removeCrowdfunding: true, closeTable: false, ban: false });
  });
});

describe('removeCrowdfunding', () => {
  it('takes it down, accepts the reports waiting on it, and tells the submitter why', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });
    await fileCrowdfundingReport(
      test.db,
      bruno,
      campaign,
      { reason: 'scam', details: '' },
      { now },
    );
    await fileCrowdfundingReport(
      test.db,
      member(3),
      campaign,
      { reason: 'spam', details: '' },
      { now },
    );

    const eventIds = await removeCrowdfunding(
      test.db,
      admin,
      campaign,
      { reason: 'scam', note: 'Sem entrega.' },
      { now },
    );

    const [row] = await test.db.select().from(crowdfundings);
    expect(row).toMatchObject({
      removedBy: admin.id,
      removalReason: 'scam',
      removalNote: 'Sem entrega.',
    });
    expect(row.removedAt).toEqual(now);
    expect((await test.db.select().from(reports)).map((r) => r.status)).toEqual([
      'resolved',
      'resolved',
    ]);
    const types = (await test.db.select().from(events))
      .filter((event) => eventIds.includes(event.id))
      .map((event) => event.type)
      .sort();
    expect(types).toEqual(['CrowdfundingRemoved', 'ReportResolved', 'ReportResolved']);

    await moderationHandler.handle(await stored(eventIds.at(-1)!), test.db);
    const [notice] = await test.db.select().from(notifications);
    expect(notice).toMatchObject({
      recipientId: ana.id,
      type: 'moderation_notice',
      link: null,
      metadata: { campaign: 'Meu RPG', reason: 'scam', note: 'Sem entrega.' },
    });
  });

  it('does not tell the submitter twice when the handler runs again', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });
    const eventIds = await removeCrowdfunding(
      test.db,
      admin,
      campaign,
      { reason: 'spam', note: '' },
      { now },
    );
    const event = await stored(eventIds.at(-1)!);

    await moderationHandler.handle(event, test.db);
    await moderationHandler.handle(event, test.db);

    expect(await test.db.select().from(notifications)).toHaveLength(1);
  });

  it('refuses one already down, an unknown one and anyone but an admin', async () => {
    const { id: campaign } = await addCrowdfunding(test.db, ana, input(), { now });
    await expect(
      removeCrowdfunding(test.db, bruno, campaign, { reason: 'spam', note: '' }),
    ).rejects.toBeInstanceOf(Forbidden);
    await removeCrowdfunding(test.db, admin, campaign, { reason: 'spam', note: '' }, { now });
    await expect(
      removeCrowdfunding(test.db, admin, campaign, { reason: 'spam', note: '' }),
    ).rejects.toMatchObject({ message: 'closed' });
    await expect(
      removeCrowdfunding(test.db, admin, crypto.randomUUID(), { reason: 'spam', note: '' }),
    ).rejects.toMatchObject({ message: 'not_found' });
  });
});

describe('listAdminCrowdfundings', () => {
  it('shows what is up by default with its waiting reports, and what was removed on request', async () => {
    const { id: a } = await addCrowdfunding(
      test.db,
      ana,
      input({ url: 'https://catarse.me/a', name: 'A' }),
      { now },
    );
    const { id: b } = await addCrowdfunding(
      test.db,
      ana,
      input({ url: 'https://catarse.me/b', name: 'B' }),
      { now },
    );
    await fileCrowdfundingReport(test.db, bruno, a, { reason: 'spam', details: '' }, { now });
    await removeCrowdfunding(test.db, admin, b, { reason: 'off_topic', note: '' }, { now });

    const up = await listAdminCrowdfundings(test.db, admin, new URLSearchParams());
    expect(up?.rows.map((row) => [row.name, row.reports])).toEqual([['A', 1]]);
    const removed = await listAdminCrowdfundings(
      test.db,
      admin,
      new URLSearchParams('status=removed'),
    );
    expect(removed?.rows.map((row) => row.name)).toEqual(['B']);
    expect(await listAdminCrowdfundings(test.db, admin, new URLSearchParams('page=2'))).toBeNull();
    await expect(
      listAdminCrowdfundings(test.db, bruno, new URLSearchParams()),
    ).rejects.toBeInstanceOf(Forbidden);
  });
});

describe('takeLinkRead', () => {
  it('lets a member read a link 30 times an hour, then refuses and says when to try again', async () => {
    for (let n = 0; n < 30; n++) await takeLinkRead(test.db, ana.id, { now });

    await expect(takeLinkRead(test.db, ana.id, { now })).rejects.toBeInstanceOf(RateLimited);
    // Another member has their own allowance.
    await expect(takeLinkRead(test.db, bruno.id, { now })).resolves.toBeUndefined();
  });

  it('frees up once the hour has passed', async () => {
    for (let n = 0; n < 30; n++) await takeLinkRead(test.db, ana.id, { now });

    const later = new Date(now.getTime() + 3_601_000);
    await expect(takeLinkRead(test.db, ana.id, { now: later })).resolves.toBeUndefined();
  });

  it('is not shown in the admin audit trail, which lists only decisions', async () => {
    await takeLinkRead(test.db, ana.id, { now });

    const [row] = await test.db.select().from(events);
    expect(row).toMatchObject({ type: 'CrowdfundingLinkRead', actorId: ana.id, payload: {} });
  });
});
