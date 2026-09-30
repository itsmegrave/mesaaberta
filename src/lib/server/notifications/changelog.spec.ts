import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { notifications, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { ChangelogEntry } from '$lib/changelog/entries';
import { ANNOUNCE_WINDOW_DAYS, announceChangelog, announcementId, plainSummary } from './changelog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000c01';
const bia = '00000000-0000-4000-8000-000000000c02';
const suspended = '00000000-0000-4000-8000-000000000c03';
const now = new Date('2026-10-01T12:00:00Z');

const entry = (over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  slug: '2026-09-29-mesas-mais-faceis',
  title: 'Mesas mais fáceis',
  date: '2026-09-29',
  summary: '<p>Sugira tags ao <strong>abrir</strong> uma mesa.</p>',
  draft: false,
  sections: [],
  ...over,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: suspended, username: 'suspensa', status: 'suspended' },
  ]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(notifications));

const sent = () => test.db.select().from(notifications);

describe('announceChangelog', () => {
  it('tells every active person about a new entry, in the bell, linking to it', async () => {
    const count = await announceChangelog(test.db, [entry()], now);

    expect(count).toBe(1);
    const rows = await sent();
    expect(rows.map((row) => row.recipientId).sort()).toEqual([ana, bia]);
    expect(rows[0]).toMatchObject({
      category: 'system',
      type: 'system_announcement',
      title: 'Mesas mais fáceis',
      body: 'Sugira tags ao abrir uma mesa.',
      link: '/changelog#2026-09-29-mesas-mais-faceis',
      eventId: await announcementId('2026-09-29-mesas-mais-faceis'),
    });
  });

  it('announces an entry once, however many times it runs', async () => {
    await announceChangelog(test.db, [entry()], now);
    expect(await announceChangelog(test.db, [entry()], now)).toBe(0);

    // Someone who read it and someone who signed up later get nothing new either.
    await test.db
      .update(notifications)
      .set({ readAt: now })
      .where(eq(notifications.recipientId, ana));
    expect(await announceChangelog(test.db, [entry()], now)).toBe(0);
    expect(await sent()).toHaveLength(2);
  });

  it('leaves out drafts, entries dated in the future and old ones', async () => {
    const old = new Date(now.getTime() - (ANNOUNCE_WINDOW_DAYS + 1) * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const count = await announceChangelog(
      test.db,
      [
        entry({ slug: 'rascunho', draft: true }),
        entry({ slug: 'amanha', date: '2026-10-02' }),
        entry({ slug: 'antiga', date: old }),
      ],
      now,
    );

    expect(count).toBe(0);
    expect(await sent()).toHaveLength(0);
  });

  it('gives each entry its own stable key', async () => {
    expect(await announcementId('a')).toBe(await announcementId('a'));
    expect(await announcementId('a')).not.toBe(await announcementId('b'));
    expect(await announcementId('a')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('shows the summary as plain text, shortened when long', () => {
    expect(plainSummary('<p>Uma &amp; outra.</p>\n<p>Mais.</p>')).toBe('Uma & outra. Mais.');
    // An escaped entity stays what was written, not decoded twice.
    expect(plainSummary('<p>Escreva &amp;lt;b&amp;gt; e &lt;b&gt;</p>')).toBe(
      'Escreva &lt;b&gt; e <b>',
    );
    expect(plainSummary('')).toBeNull();
    expect(plainSummary(`<p>${'a'.repeat(300)}</p>`)).toHaveLength(200);
  });
});
