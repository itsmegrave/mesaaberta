import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { events, notifications, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { announceChangelogDay } from '@mesaaberta/core/server/notifications/changelog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000e01';
const bruno = '00000000-0000-4000-8000-000000000e02';
const suspended = '00000000-0000-4000-8000-000000000e03';
const handlers = handlersFor(undefined);

const day = {
  date: '2026-10-26',
  title: 'Novidades: Lembretes de sessão',
  summary: 'A mesa avisa antes da sessão.',
  link: '/changelog#2026-10-26',
};
const today = new Date('2026-10-26T12:00:00Z');

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bruno, username: 'bruno' },
    { id: suspended, username: 'suspensa', status: 'suspended' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(events);
});

describe('announceChangelogDay', () => {
  it('puts the day in every active bell once it is delivered', async () => {
    const id = await announceChangelogDay(test.db, day, today);
    expect(id).not.toBeNull();
    await dispatchEvent(test.db, handlers, id!);

    const rows = await test.db.select().from(notifications);
    expect(rows.map((row) => row.recipientId).sort()).toEqual([ana, bruno]);
    expect(rows[0]).toMatchObject({ title: day.title, body: day.summary, link: day.link });
  });

  it('sends a day only once, however often it runs', async () => {
    await announceChangelogDay(test.db, day, today);
    expect(await announceChangelogDay(test.db, day, today)).toBeNull();
    const sent = await test.db.select().from(events);
    expect(sent).toHaveLength(1);
    expect(sent[0].actorId).toBeNull();
  });

  it('sends a newer day after an older one', async () => {
    await announceChangelogDay(test.db, day, today);
    const next = { ...day, date: '2026-10-27', link: '/changelog#2026-10-27' };
    expect(
      await announceChangelogDay(test.db, next, new Date('2026-10-27T12:00:00Z')),
    ).not.toBeNull();
    expect(await test.db.select().from(events)).toHaveLength(2);
  });

  it('does not replay a day older than three days', async () => {
    expect(await announceChangelogDay(test.db, day, new Date('2026-10-30T12:00:00Z'))).toBeNull();
    expect(await test.db.select().from(events)).toHaveLength(0);
  });
});
