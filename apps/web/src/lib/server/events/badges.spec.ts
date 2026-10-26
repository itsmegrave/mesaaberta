import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  crowdfundings,
  events,
  gameTables,
  notifications,
  partners,
  profiles,
  ratings,
  registrations,
  reports,
  systems,
  tags,
  userBadges,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { badgeHandler, badgeNoticeHandler } from '@mesaaberta/core/server/badges/handlers';
import { BADGES } from '@mesaaberta/core/server/badges/catalog';
import type { DomainEvent, StoredEvent } from '@mesaaberta/core/server/events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000040${String(n).padStart(2, '0')}`;
const gm = id(1);
const [p1, p2] = [id(2), id(3)];
let sequence = 0;
let counter = 0;
let systemIds: string[] = [];

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestra' },
    { id: p1, username: 'jogadora' },
    { id: p2, username: 'ausente' },
  ]);
  systemIds = (await test.db.select({ id: systems.id }).from(systems).limit(6)).map((s) => s.id);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(userBadges);
  await test.db.delete(notifications);
  await test.db.delete(events);
  await test.db.delete(ratings);
  await test.db.delete(registrations);
  await test.db.delete(gameTables);
  await test.db.delete(partners);
});

const stored = (event: DomainEvent): StoredEvent => ({
  ...event,
  id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  actorId: null,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  attempts: 0,
});

/** A concluded table with its players; `absent` are marked as not having shown up. */
async function concluded(
  players: string[],
  absent: string[] = [],
  system = systemIds[0],
  inPerson = false,
) {
  const slug = `badge-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm,
      systemId: system,
      status: 'concluded',
      ...(inPerson ? { modality: 'in_person' as const, locationArea: 'Centro' } : {}),
    })
    .returning();
  if (players.length)
    await test.db.insert(registrations).values(
      players.map((playerId) => ({
        tableId: table.id,
        playerId,
        status: 'confirmed' as const,
        attended: absent.includes(playerId) ? false : null,
      })),
    );
  return stored({
    type: 'TableConcluded',
    payload: { tableId: table.id, slug, title: slug, absentPlayerIds: absent },
  });
}

const held = async (profileId: string) =>
  (await test.db.select().from(userBadges).where(eq(userBadges.profileId, profileId)))
    .map((row) => row.badgeId)
    .sort();
const earnedEvents = async () =>
  (await test.db.select().from(events)).filter((event) => event.type === 'BadgeEarned');

describe('badges-v1', () => {
  it('awards the first table to a player and to the GM', async () => {
    await badgeHandler.handle(await concluded([p1]), test.db);

    expect(await held(p1)).toEqual(['first-table']);
    expect(await held(gm)).toEqual(['gm-first']);
    expect(await earnedEvents()).toHaveLength(2);
  });

  it('does not count a session the player was marked absent from', async () => {
    await badgeHandler.handle(await concluded([p1, p2], [p2]), test.db);

    expect(await held(p1)).toEqual(['first-table']);
    expect(await held(p2)).toEqual([]);
  });

  it('awards nothing twice when the event is retried', async () => {
    const event = await concluded([p1]);
    await badgeHandler.handle(event, test.db);
    await badgeHandler.handle(event, test.db);

    expect(await held(p1)).toEqual(['first-table']);
    expect(await earnedEvents()).toHaveLength(2);
  });

  it('does not give back a revoked badge', async () => {
    const event = await concluded([p1]);
    await badgeHandler.handle(event, test.db);
    await test.db
      .update(userBadges)
      .set({ revokedAt: new Date(), revokeReason: 'abuse' })
      .where(and(eq(userBadges.profileId, p1), eq(userBadges.badgeId, 'first-table')));
    await test.db.delete(events);

    await badgeHandler.handle(event, test.db);

    expect(
      (await test.db.select().from(userBadges)).find((b) => b.profileId === p1)?.revokedAt,
    ).not.toBeNull();
    expect(await earnedEvents()).toEqual([]);
  });

  it('climbs the ladder at five sessions and counts five different systems', async () => {
    let last!: StoredEvent;
    for (let n = 0; n < 5; n += 1) {
      last = await concluded([p1], [], systemIds[n]);
      if (n < 4) await badgeHandler.handle(last, test.db);
    }
    expect(await held(p1)).toEqual(['first-table']);

    await badgeHandler.handle(last, test.db);

    expect(await held(p1)).toEqual(['first-table', 'regular-player-1', 'system-explorer']);
    // Five tables of five systems: the GM ran three or more.
    expect(await held(gm)).toEqual(['gm-first', 'gm-master-1', 'wandering-gm']);
  });

  it('awards the in-person badge to the GM and the players present, not to the absent', async () => {
    await badgeHandler.handle(await concluded([p1, p2], [p2], systemIds[0], true), test.db);

    expect(await held(p1)).toContain('in-person-table');
    expect(await held(gm)).toContain('in-person-table');
    expect(await held(p2)).toEqual([]);
  });

  it('gives no in-person badge for an online table', async () => {
    await badgeHandler.handle(await concluded([p1]), test.db);

    expect(await held(p1)).not.toContain('in-person-table');
  });

  it('awards the critic on the tenth rating', async () => {
    for (let n = 0; n < 10; n += 1) {
      const event = await concluded([p1]);
      const tableId = (event.payload as { tableId: string }).tableId;
      await test.db.insert(ratings).values({ tableId, playerId: p1, gmScore: 5 } as never);
    }
    const trigger = stored({
      type: 'RatingSubmitted',
      payload: { tableId: id(90), slug: 'x', playerId: p1 },
    });

    await badgeHandler.handle(trigger, test.db);

    expect(await held(p1)).toEqual(['thoughtful-critic']);
  });

  it('awards the partner badge once a partner of the submitter is approved', async () => {
    await test.db.insert(partners).values({
      submitterId: p1,
      name: 'Loja',
      logoPath: `partners/${p1}/logo.png`,
      approvedAt: new Date(),
    } as never);

    await badgeHandler.handle(
      stored({
        type: 'PartnerApproved',
        payload: { submitterId: p1 } as never,
      }),
      test.db,
    );

    expect(await held(p1)).toEqual(['partner']);
  });

  it('gives the first 100 to who signed up among the first hundred, and not to the 101st', async () => {
    const people = Array.from({ length: 101 }, (_, i) => ({
      id: `00000000-0000-4000-8000-000000050${String(i).padStart(3, '0')}`,
      username: `cedo${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
    }));
    // The three profiles of the other tests joined later than all of them.
    await test.db.update(profiles).set({ createdAt: new Date('2026-06-01T00:00:00Z') });
    await test.db.insert(profiles).values(people);
    const update = (profileId: string) =>
      badgeHandler.handle(
        stored({ type: 'ProfileUpdated', payload: { profileId, changes: {} } }),
        test.db,
      );

    await update(people[99].id);
    await update(people[100].id);

    const held = async (profileId: string) =>
      (await test.db.select().from(userBadges).where(eq(userBadges.profileId, profileId))).map(
        (row) => row.badgeId,
      );
    expect(await held(people[99].id)).toEqual(['first-100']);
    expect(await held(people[100].id)).toEqual([]);
    await test.db.delete(profiles).where(eq(profiles.username, 'cedo0'));
  });

  it('keeps the catalog ids valid and unique', () => {
    const ids = BADGES.map((badge) => badge.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const badgeId of ids) expect(badgeId).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('badges-v1, phase 2', () => {
  /** A table run by the GM, with the given confirmed players, concluded unless `status` says. */
  async function table(
    players: string[],
    {
      kind = 'one_shot' as 'one_shot' | 'adventure',
      capacity = 5,
      system = systemIds[0],
      status = 'concluded' as 'concluded' | 'not_held' | 'disabled',
      startsAt = new Date(Date.UTC(2026, 8, 1 + counter)),
    } = {},
  ) {
    const slug = `phase-${++counter}`;
    const [row] = await test.db
      .insert(gameTables)
      .values({
        slug,
        title: slug,
        kind,
        capacity,
        startsAt,
        durationMinutes: 180,
        timezone: 'America/Sao_Paulo',
        gmId: gm,
        systemId: system,
        status,
      })
      .returning();
    if (players.length)
      await test.db
        .insert(registrations)
        .values(
          players.map((playerId) => ({ tableId: row.id, playerId, status: 'confirmed' as const })),
        );
    return stored({
      type: 'TableConcluded',
      payload: { tableId: row.id, slug, title: slug, absentPlayerIds: [] },
    });
  }

  it('awards the one-shot adventurer on the tenth one-shot, not counting adventures', async () => {
    let last!: StoredEvent;
    for (let n = 0; n < 9; n += 1) last = await table([p1]);
    await table([p1], { kind: 'adventure' });
    await badgeHandler.handle(last, test.db);
    expect(await held(p1)).not.toContain('one-shot-adventurer');

    await badgeHandler.handle(await table([p1]), test.db);
    expect(await held(p1)).toContain('one-shot-adventurer');
  });

  it('awards the full table to a GM with five tables that filled every seat', async () => {
    let last!: StoredEvent;
    for (let n = 0; n < 4; n += 1) last = await table([p1, p2], { capacity: 2 });
    await table([p1], { capacity: 2 });
    await badgeHandler.handle(last, test.db);
    expect(await held(gm)).not.toContain('full-table');

    await badgeHandler.handle(await table([p1, p2], { capacity: 2 }), test.db);
    expect(await held(gm)).toContain('full-table');
  });

  it('awards the open door at 25 different players, counted once each', async () => {
    const guests = Array.from({ length: 25 }, (_, n) => ({
      id: `00000000-0000-4000-8000-000000060${String(n).padStart(3, '0')}`,
      username: `convidada${n}`,
    }));
    await test.db.insert(profiles).values(guests);
    await table(guests.slice(0, 12).map((guest) => guest.id));
    const repeat = await table(guests.slice(0, 12).map((guest) => guest.id));
    await badgeHandler.handle(repeat, test.db);
    expect(await held(gm)).not.toContain('open-door');

    await badgeHandler.handle(await table(guests.slice(12).map((guest) => guest.id)), test.db);
    expect(await held(gm)).toContain('open-door');
    await test.db.delete(registrations);
    for (const guest of guests) await test.db.delete(profiles).where(eq(profiles.id, guest.id));
  });

  it('awards the word kept after ten tables in a row, a cancelled one restarting the count', async () => {
    for (let n = 0; n < 5; n += 1) await table([]);
    await table([], { status: 'disabled' });
    let last!: StoredEvent;
    for (let n = 0; n < 9; n += 1) last = await table([]);
    await badgeHandler.handle(last, test.db);
    expect(await held(gm)).not.toContain('word-kept');

    await badgeHandler.handle(await table([]), test.db);
    expect(await held(gm)).toContain('word-kept');
  });

  it('awards the beloved GM from the rating, to the GM it is about', async () => {
    const players = Array.from({ length: 10 }, (_, n) => ({
      id: `00000000-0000-4000-8000-000000061${String(n).padStart(3, '0')}`,
      username: `avaliadora${n}`,
    }));
    await test.db.insert(profiles).values(players);
    let trigger!: StoredEvent;
    for (const player of players) {
      const event = await table([player.id]);
      const tableId = (event.payload as { tableId: string }).tableId;
      await test.db.insert(ratings).values({ tableId, playerId: player.id, gmScore: 5 } as never);
      trigger = stored({
        type: 'RatingSubmitted',
        payload: { tableId, slug: 'x', playerId: player.id },
      });
    }

    await badgeHandler.handle(trigger, test.db);

    expect(await held(gm)).toContain('beloved-gm');
    await test.db.delete(ratings);
    await test.db.delete(registrations);
    for (const player of players) await test.db.delete(profiles).where(eq(profiles.id, player.id));
  });

  it('awards the guardian on the third report an admin accepted', async () => {
    const tableId = (
      (await table([p1])).payload as {
        tableId: string;
      }
    ).tableId;
    const file = (status: 'resolved' | 'dismissed') =>
      test.db
        .insert(reports)
        .values({
          reporterId: p1,
          targetType: 'table',
          targetId: tableId,
          tableId,
          reason: 'other',
          status,
        } as never)
        .returning({ id: reports.id });
    await file('resolved');
    await file('resolved');
    const [dismissed] = await file('dismissed');
    const resolved = (reportId: string) =>
      stored({ type: 'ReportResolved', payload: { reportId, reporterId: p1 } });
    await badgeHandler.handle(resolved(dismissed.id), test.db);
    expect(await held(p1)).not.toContain('table-guardian');

    const [third] = await file('resolved');
    await badgeHandler.handle(resolved(third.id), test.db);
    expect(await held(p1)).toContain('table-guardian');
    await test.db.delete(reports);
  });

  it('awards the promoter to the member who added three campaigns still up', async () => {
    const add = (n: number, removed = false) =>
      test.db.insert(crowdfundings).values({
        submitterId: p1,
        url: `https://www.catarse.me/campanha-${n}`,
        platform: 'catarse',
        name: `Campanha ${n}`,
        owner: 'Editora',
        startsOn: '2026-10-01',
        endsOn: '2026-11-01',
        ...(removed ? { removedAt: new Date() } : {}),
      } as never);
    const added = {
      ...stored({ type: 'CrowdfundingAdded', payload: { crowdfundingId: id(91), name: 'x' } }),
      actorId: p1,
    };
    await add(1);
    await add(2);
    await add(3, true);
    await badgeHandler.handle(added, test.db);
    expect(await held(p1)).not.toContain('promoter');

    await add(4);
    await badgeHandler.handle({ ...added, id: id(92) }, test.db);
    expect(await held(p1)).toContain('promoter');
    await test.db.delete(crowdfundings);
  });

  it('awards the curator to whoever suggested the entry an admin approved', async () => {
    const [tag] = await test.db
      .insert(tags)
      .values({
        name: 'Horror cósmico',
        slug: 'horror-cosmico-badge',
        status: 'approved',
        suggestedBy: p1,
      })
      .returning({ id: tags.id });

    await badgeHandler.handle(
      stored({
        type: 'CatalogEntryApproved',
        payload: { kind: 'tag', entryId: tag.id, name: 'Horror cósmico' },
      }),
      test.db,
    );

    expect(await held(p1)).toContain('curator');
    await test.db.delete(tags).where(eq(tags.id, tag.id));
  });
});

describe('badge-notice-v1', () => {
  it('writes one notice for a BadgeEarned event, even when retried', async () => {
    const event = stored({
      type: 'BadgeEarned',
      payload: { profileId: p1, badgeId: 'first-table' },
    });

    await badgeNoticeHandler.handle(event, test.db);
    await badgeNoticeHandler.handle(event, test.db);

    const rows = await test.db.select().from(notifications);
    expect(rows).toEqual([
      expect.objectContaining({
        recipientId: p1,
        type: 'badge_earned',
        category: 'achievements',
        link: '/u/jogadora#conquistas',
        metadata: { badgeId: 'first-table' },
      }),
    ]);
  });
});
