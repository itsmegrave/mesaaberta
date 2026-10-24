import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  profiles,
  registrations,
  conversations,
  conversationMembers,
  messages,
  ratings,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { createTable, updateTable, publishTable } from '@mesaaberta/core/server/tables/write';
import { postponeTable } from '@mesaaberta/core/server/tables/lifecycle';
import { duplicateTable, loadTableForDuplication } from '@mesaaberta/core/server/tables/duplicate';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000101',
  role: 'member',
  status: 'active',
};
const other: Actor = {
  id: '00000000-0000-4000-8000-000000000102',
  role: 'admin',
  status: 'active',
};
const input = (over: Partial<TableInput> = {}): TableInput => ({
  systemSlug: 'daggerheart',
  title: 'Fonte',
  description: '<p>Uma aventura</p>',
  extraInfo: '<p>Extras</p>',
  welcomeMessage: '<p>Bem-vindo</p>',
  kind: 'one_shot',
  capacity: 5,
  minPlayers: 3,
  startsAtLocal: '2026-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
  recurrence: null,
  untilLocalDate: null,
  joinMode: 'approval',
  modality: 'online',
  locationArea: null,
  joinDetails: '<p>Privado</p>',
  postalCode: null,
  locationNeighbourhood: null,
  locationCity: null,
  locationState: null,
  platforms: [],
  tags: [],
  removeImage: false,
  ...over,
});
const row = async (slug: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: actor.id, username: 'duplicate-gm' },
    { id: other.id, username: 'duplicate-admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(events));
const source = () =>
  createTable(test.db, actor, input(), { now, imagePath: 'tables/original.png' });

describe('table duplication', () => {
  it('copies an owned concluded source with a blank required date and an explicit content whitelist', async () => {
    const original = await source();
    await test.db
      .update(gameTables)
      .set({ status: 'concluded', icalSequence: 8 })
      .where(eq(gameTables.slug, original.slug));
    const originalRow = await row(original.slug);
    await test.db
      .insert(registrations)
      .values({ tableId: originalRow.id, playerId: other.id, status: 'confirmed' });
    const [sourceChat] = await test.db
      .select()
      .from(conversations)
      .where(eq(conversations.tableId, originalRow.id));
    await test.db
      .insert(messages)
      .values({ conversationId: sourceChat.id, senderId: actor.id, body: 'Histórico privado' });
    await test.db
      .insert(ratings)
      .values({ tableId: originalRow.id, playerId: other.id, gmScore: 5 });
    const loaded = await loadTableForDuplication(test.db, actor, original.slug);
    expect(loaded.input).toEqual(input({ startsAtLocal: '' }));
    expect(loaded.imagePath).toBe('tables/original.png');
    expect(Object.keys(loaded.input)).not.toContain('status');
    const copied = await duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ startsAtLocal: '2026-10-11T19:00' }),
      { now },
    );
    const copy = await row(copied.slug);
    expect(copy).toMatchObject({
      gmId: actor.id,
      status: 'active',
      minPlayers: 3,
      imagePath: 'tables/original.png',
      icalSequence: 0,
      duplicatedFromTableId: loaded.sourceId,
    });
    expect(copy.id).not.toBe(loaded.sourceId);
    expect(
      await test.db.select().from(registrations).where(eq(registrations.tableId, copy.id)),
    ).toEqual([]);
    const [chat] = await test.db
      .select()
      .from(conversations)
      .where(eq(conversations.tableId, copy.id));
    expect(
      await test.db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, chat.id)),
    ).toHaveLength(1);
    expect(
      await test.db.select().from(messages).where(eq(messages.conversationId, chat.id)),
    ).toEqual([]);
    expect(await test.db.select().from(ratings).where(eq(ratings.tableId, copy.id))).toEqual([]);
  });
  it('refuses anonymous actors, other owners including admins, suspended owners and moderated sources', async () => {
    const original = await source();
    for (const denied of [null, other, { ...actor, status: 'suspended' as const }]) {
      await expect(loadTableForDuplication(test.db, denied, original.slug)).rejects.toThrow();
      await expect(
        duplicateTable(
          test.db,
          denied,
          original.slug,
          input({ startsAtLocal: '2026-10-11T19:00' }),
          { now },
        ),
      ).rejects.toThrow();
    }
    await test.db
      .update(gameTables)
      .set({ moderatedAt: now, status: 'disabled' })
      .where(eq(gameTables.slug, original.slug));
    await expect(
      duplicateTable(test.db, actor, original.slug, input({ startsAtLocal: '2026-10-11T19:00' }), {
        now,
      }),
    ).rejects.toThrow();
  });
  it('rejects every overlapping interval including drafts without leaving a copy or event', async () => {
    const original = await source();
    const before = await test.db.select().from(gameTables);
    const recorded = await test.db.select().from(events);
    for (const startsAtLocal of ['2026-10-10T19:00', '2026-10-10T20:00', '2026-10-10T18:00']) {
      await expect(
        duplicateTable(test.db, actor, original.slug, input({ startsAtLocal }), {
          now,
          draft: true,
        }),
      ).rejects.toMatchObject({ field: 'startsAtLocal', message: 'schedule_conflict' });
    }
    expect(await test.db.select().from(gameTables)).toHaveLength(before.length);
    expect(await test.db.select().from(events)).toHaveLength(recorded.length);
  });
  it('permits adjacency and rejects edits of either end and publication that create overlap', async () => {
    const original = await source();
    const copied = await duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ startsAtLocal: '2026-10-10T23:00' }),
      { now, draft: true },
    );
    await expect(
      updateTable(test.db, actor, copied.slug, input({ startsAtLocal: '2026-10-10T22:30' })),
    ).rejects.toMatchObject({ message: 'schedule_conflict' });
    await expect(
      updateTable(test.db, actor, original.slug, input({ durationMinutes: 300 })),
    ).rejects.toMatchObject({ message: 'schedule_conflict' });
    await test.db
      .update(gameTables)
      .set({ startsAt: new Date('2026-10-11T01:30:00Z') })
      .where(eq(gameTables.slug, copied.slug));
    await expect(publishTable(test.db, actor, copied.slug, now)).rejects.toMatchObject({
      message: 'schedule_conflict',
    });
  });
  it('retries the same submission once and preserves an inherited immutable image after source removal', async () => {
    const original = await source();
    const options = { now, requestKey: crypto.randomUUID() };
    const first = await duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ startsAtLocal: '2026-10-11T19:00' }),
      options,
    );
    expect(
      await duplicateTable(
        test.db,
        actor,
        original.slug,
        input({ startsAtLocal: '2026-10-11T19:00' }),
        options,
      ),
    ).toEqual(first);
    await updateTable(test.db, actor, original.slug, input({ removeImage: true }));
    expect((await row(first.slug)).imagePath).toBe('tables/original.png');
  });
  it('keeps two copies of one source from overlapping each other', async () => {
    const original = await source();
    await duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ startsAtLocal: '2026-10-11T19:00' }),
      { now },
    );
    await expect(
      duplicateTable(test.db, actor, original.slug, input({ startsAtLocal: '2026-10-11T20:00' }), {
        now,
      }),
    ).rejects.toMatchObject({ field: 'startsAtLocal', message: 'schedule_conflict' });
  });
  it('lets a copy take the slot of a source that was not held', async () => {
    const original = await source();
    await test.db
      .update(gameTables)
      .set({ status: 'not_held' })
      .where(eq(gameTables.slug, original.slug));
    await expect(
      duplicateTable(test.db, actor, original.slug, input({ startsAtLocal: '2026-10-10T19:00' }), {
        now,
      }),
    ).resolves.toBeDefined();
  });
  it('answers a replay with the existing copy after its source was moderated or unlinked', async () => {
    const original = await source();
    const options = { now, requestKey: crypto.randomUUID() };
    const date = input({ startsAtLocal: '2026-10-12T19:00' });
    const first = await duplicateTable(test.db, actor, original.slug, date, options);
    await test.db
      .update(gameTables)
      .set({ moderatedAt: now })
      .where(eq(gameTables.slug, original.slug));
    expect(await duplicateTable(test.db, actor, original.slug, date, options)).toEqual(first);
    await test.db
      .update(gameTables)
      .set({ duplicatedFromTableId: null })
      .where(eq(gameTables.slug, first.slug));
    expect(await duplicateTable(test.db, actor, original.slug, date, options)).toEqual(first);
  });
  it('rejects blank dates and recurrence ending before the new date even for direct service calls', async () => {
    const original = await source();
    await expect(
      duplicateTable(test.db, actor, original.slug, input({ startsAtLocal: '' }), { now }),
    ).rejects.toMatchObject({ field: 'startsAtLocal' });
    await expect(
      duplicateTable(
        test.db,
        actor,
        original.slug,
        input({
          kind: 'campaign',
          recurrence: 'FREQ=WEEKLY',
          untilLocalDate: '2026-10-10',
          startsAtLocal: '2026-10-11T19:00',
        }),
        { now },
      ),
    ).rejects.toMatchObject({ field: 'until' });
  });
});

it('prevents postponement from bypassing the immediate copy schedule guard', async () => {
  const original = await source();
  await duplicateTable(
    test.db,
    actor,
    original.slug,
    input({ startsAtLocal: '2026-10-11T19:00' }),
    { now },
  );
  await test.db
    .update(gameTables)
    .set({ status: 'awaiting_confirmation' })
    .where(eq(gameTables.slug, original.slug));
  await expect(
    postponeTable(test.db, actor, original.slug, '2026-10-11T19:00', now),
  ).rejects.toMatchObject({ message: 'schedule_conflict' });
});

it('preserves biweekly recurrence, end date, timezone and in-person private configuration', async () => {
  const configured = input({
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY;INTERVAL=2',
    untilLocalDate: '2026-12-30',
    timezone: 'Europe/Lisbon',
    modality: 'in_person',
    postalCode: '50030000',
    locationArea: 'Recife',
    locationNeighbourhood: 'Santo Antônio',
    locationCity: 'Recife',
    locationState: 'PE',
  });
  const original = await createTable(test.db, actor, configured, { now });
  expect((await loadTableForDuplication(test.db, actor, original.slug)).input).toEqual({
    ...configured,
    startsAtLocal: '',
  });
  const copy = await duplicateTable(
    test.db,
    actor,
    original.slug,
    { ...configured, startsAtLocal: '2026-10-11T19:00' },
    { now },
  );
  expect(await row(copy.slug)).toMatchObject({
    recurrence: configured.recurrence,
    until: (await row(original.slug)).until,
    timezone: configured.timezone,
    postalCode: configured.postalCode,
    locationNeighbourhood: configured.locationNeighbourhood,
    joinDetails: configured.joinDetails,
  });
});
it('keeps pending systems as drafts and refuses catalog entries made unavailable after the form opens', async () => {
  const [pending] = await test.db
    .insert(systems)
    .values({
      name: 'Sistema em revisão para cópia',
      slug: 'sistema-em-revisao-para-copia',
      status: 'pending',
      suggestedBy: actor.id,
    })
    .returning();
  const original = await createTable(test.db, actor, input({ systemSlug: pending.slug }), { now });
  const copied = await duplicateTable(
    test.db,
    actor,
    original.slug,
    input({ systemSlug: pending.slug, startsAtLocal: '2026-10-11T19:00' }),
    { now },
  );
  expect(copied.draft).toBe(true);
  await test.db.update(systems).set({ status: 'rejected' }).where(eq(systems.id, pending.id));
  await expect(
    duplicateTable(
      test.db,
      actor,
      original.slug,
      input({ systemSlug: pending.slug, startsAtLocal: '2026-10-12T19:00' }),
      { now },
    ),
  ).rejects.toMatchObject({ field: 'systemSlug' });
});
