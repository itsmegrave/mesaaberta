import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  pollOptions,
  polls,
  pollVotes,
  profiles,
  widgetDismissals,
  widgets,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb, pgErrorCode } from './test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000a01';

const poll = async () => {
  const [widget] = await test.db
    .insert(widgets)
    .values({ kind: 'poll', title: 'Sistemas', placements: ['*'] })
    .returning();
  await test.db.insert(polls).values({ widgetId: widget.id, question: 'Qual sistema?' });
  const options = await test.db
    .insert(pollOptions)
    .values([
      { pollId: widget.id, label: 'D&D', position: 0 },
      { pollId: widget.id, label: 'Tormenta', position: 1 },
    ])
    .returning();
  return { widget, options };
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: ana, username: 'ana' });
});
afterAll(() => test.close());

describe('the widget and poll tables', () => {
  it('starts a widget as a draft aimed at everyone, and a poll with public results at 10 votes', async () => {
    const { widget } = await poll();
    expect(widget).toMatchObject({ status: 'draft', audience: { include: [], exclude: [] } });
    const [row] = await test.db.select().from(polls).where(eq(polls.widgetId, widget.id));
    expect(row).toMatchObject({ choice: 'single', results: 'admin', publicMinVotes: 10 });
  });

  it('takes one vote per option and person', async () => {
    const { widget, options } = await poll();
    const vote = { pollId: widget.id, optionId: options[0].id, profileId: ana };
    await test.db.insert(pollVotes).values(vote);
    expect(await pgErrorCode(test.db.insert(pollVotes).values(vote))).toBe('23505');
  });

  it('refuses a kind that is not a slug, an empty question and an end before the start', async () => {
    expect(await pgErrorCode(test.db.insert(widgets).values({ kind: 'Poll!', title: 'x' }))).toBe(
      '23514',
    );
    const [widget] = await test.db.insert(widgets).values({ kind: 'poll', title: 'x' }).returning();
    expect(
      await pgErrorCode(test.db.insert(polls).values({ widgetId: widget.id, question: '' })),
    ).toBe('23514');
    expect(
      await pgErrorCode(
        test.db.insert(widgets).values({
          kind: 'poll',
          title: 'x',
          startsAt: new Date('2026-11-02'),
          endsAt: new Date('2026-11-01'),
        }),
      ),
    ).toBe('23514');
  });

  it('removes a poll’s options, votes and dismissals with its widget', async () => {
    const { widget, options } = await poll();
    await test.db
      .insert(pollVotes)
      .values({ pollId: widget.id, optionId: options[1].id, profileId: ana });
    await test.db.insert(widgetDismissals).values({ widgetId: widget.id, profileId: ana });
    await test.db.delete(widgets).where(eq(widgets.id, widget.id));
    expect(
      await test.db.select().from(pollOptions).where(eq(pollOptions.pollId, widget.id)),
    ).toEqual([]);
    expect(await test.db.select().from(pollVotes).where(eq(pollVotes.pollId, widget.id))).toEqual(
      [],
    );
    expect(
      await test.db.select().from(widgetDismissals).where(eq(widgetDismissals.widgetId, widget.id)),
    ).toEqual([]);
  });
});
