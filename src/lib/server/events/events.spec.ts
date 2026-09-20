import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { recordEvent } from './outbox';
import { dispatchEvent, MAX_ATTEMPTS, backoffSeconds, sweepEvents } from './dispatcher';
import type { Handler, StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const t0 = new Date('2026-10-01T12:00:00Z');
const later = (seconds: number) => new Date(t0.getTime() + seconds * 1000);
const actor = '00000000-0000-4000-8000-000000000901';
const payload = { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' };

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values({ id: actor, displayName: 'Ana' });
});
afterAll(() => test.close());
beforeEach(async () => {
	await test.db.delete(events);
});

const record = async (over: { type?: 'TableCreated' | 'TableUpdated'; at?: Date } = {}) =>
	recordEvent(
		test.db,
		{ type: over.type ?? 'TableCreated', actorId: actor, payload },
		{ now: over.at ?? t0 }
	);

const row = async (id: string) => (await test.db.select().from(events).where(eq(events.id, id)))[0];

const handler = (
	name: string,
	run: (e: StoredEvent) => Promise<void> = async () => {}
): Handler & {
	calls: StoredEvent[];
} => {
	const calls: StoredEvent[] = [];
	return {
		name,
		types: ['TableCreated'],
		calls,
		handle: async (event) => {
			calls.push(event);
			await run(event);
		}
	};
};

describe('recordEvent', () => {
	it('writes a pending row saying who did what', async () => {
		const id = await record();

		expect(await row(id)).toMatchObject({
			type: 'TableCreated',
			actorId: actor,
			payload,
			processedAt: null,
			attempts: 0,
			failedAt: null
		});
	});

	describe('is atomic with the change it describes', () => {
		const insertTable = async (db: typeof test.db, slug: string) => {
			const [system] = await db.select({ id: systems.id }).from(systems).limit(1);
			await db.insert(gameTables).values({
				slug,
				title: slug,
				kind: 'one_shot',
				capacity: 4,
				startsAt: t0,
				durationMinutes: 60,
				timezone: 'UTC',
				gmId: actor,
				systemId: system.id
			});
		};

		it('keeps both when the transaction commits', async () => {
			await test.db.transaction(async (tx) => {
				await insertTable(tx as never, 'atomic-ok');
				await recordEvent(tx as never, { type: 'TableCreated', actorId: actor, payload });
			});

			expect(await test.db.select().from(events)).toHaveLength(1);
			expect(
				await test.db.select().from(gameTables).where(eq(gameTables.slug, 'atomic-ok'))
			).toHaveLength(1);
		});

		it('loses both when the change fails after the event was written', async () => {
			await expect(
				test.db.transaction(async (tx) => {
					await recordEvent(tx as never, { type: 'TableCreated', actorId: actor, payload });
					await insertTable(tx as never, 'atomic-ok'); // a duplicate slug: unique violation
				})
			).rejects.toThrow();

			expect(await test.db.select().from(events)).toHaveLength(0);
		});

		it('loses the change when writing the event fails, so nothing changes without a record', async () => {
			await expect(
				test.db.transaction(async (tx) => {
					await insertTable(tx as never, 'atomic-fail');
					await recordEvent(tx as never, { type: 'TableCreated', actorId: 'not-a-uuid', payload });
				})
			).rejects.toThrow();

			expect(
				await test.db.select().from(gameTables).where(eq(gameTables.slug, 'atomic-fail'))
			).toHaveLength(0);
		});
	});
});

describe('dispatchEvent', () => {
	it('gives each handler for the type the event, then marks it processed', async () => {
		const id = await record();
		const a = handler('a');
		const b = handler('b');
		const other: Handler = { name: 'other', types: ['TableUpdated'], handle: vi.fn() };

		await dispatchEvent(test.db, [a, b, other], id, t0);

		expect(a.calls).toHaveLength(1);
		expect(b.calls).toHaveLength(1);
		expect(other.handle).not.toHaveBeenCalled();
		expect(a.calls[0]).toMatchObject({ id, type: 'TableCreated', actorId: actor, payload });
		expect(await row(id)).toMatchObject({ processedAt: t0, failedAt: null, lastError: null });
	});

	it('marks an event nobody listens to as processed: it is still in the audit log', async () => {
		const id = await record();

		await dispatchEvent(test.db, [], id, t0);

		expect((await row(id)).processedAt).toEqual(t0);
	});

	it('does not run a processed event again', async () => {
		const id = await record();
		const a = handler('a');

		await dispatchEvent(test.db, [a], id, t0);
		await dispatchEvent(test.db, [a], id, later(60));

		expect(a.calls).toHaveLength(1);
	});

	it('runs a handler once when two dispatchers race for the same event', async () => {
		const id = await record();
		const slow = handler('slow', () => new Promise((resolve) => setTimeout(resolve, 20)));

		await Promise.all([
			dispatchEvent(test.db, [slow], id, t0),
			dispatchEvent(test.db, [slow], id, t0)
		]);

		expect(slow.calls).toHaveLength(1);
	});

	describe('when a handler fails', () => {
		const boom = () => {
			throw new Error('smtp down for ana@example.com');
		};

		it('keeps the event pending, counts the attempt, and waits before the next one', async () => {
			const id = await record();

			await dispatchEvent(test.db, [handler('mail', boom)], id, t0);

			expect(await row(id)).toMatchObject({
				processedAt: null,
				failedAt: null,
				attempts: 1,
				nextAttemptAt: later(backoffSeconds(1))
			});
		});

		it('stores the error without an email address in it', async () => {
			const id = await record();

			await dispatchEvent(test.db, [handler('mail', boom)], id, t0);

			const { lastError } = await row(id);
			expect(lastError).toContain('smtp down');
			expect(lastError).not.toContain('ana@example.com');
		});

		it('does not stop the other handlers, and a retry runs only the one that failed', async () => {
			const id = await record();
			let broken = true;
			const good = handler('good');
			const flaky = handler('flaky', async () => {
				if (broken) throw new Error('not yet');
			});

			await dispatchEvent(test.db, [good, flaky], id, t0);
			expect(good.calls).toHaveLength(1);
			expect((await row(id)).handledBy).toEqual(['good']);

			broken = false;
			await dispatchEvent(test.db, [good, flaky], id, later(backoffSeconds(1)));

			expect(good.calls).toHaveLength(1); // not run again: it had succeeded
			expect(flaky.calls).toHaveLength(2);
			expect((await row(id)).processedAt).toEqual(later(backoffSeconds(1)));
		});

		it('gives up after the attempt cap and leaves the event for a person to look at', async () => {
			const id = await record();
			const failing = handler('failing', boom);
			let now = t0;

			for (let i = 0; i < MAX_ATTEMPTS; i++) {
				await dispatchEvent(test.db, [failing], id, now);
				now = later((now.getTime() - t0.getTime()) / 1000 + backoffSeconds(i + 1) + 1);
			}

			expect(await row(id)).toMatchObject({ attempts: MAX_ATTEMPTS, processedAt: null });
			expect((await row(id)).failedAt).not.toBeNull();

			await dispatchEvent(test.db, [failing], id, later(10 ** 7));
			expect(failing.calls).toHaveLength(MAX_ATTEMPTS);
		});
	});
});

describe('backoffSeconds', () => {
	it('doubles from 30 seconds and stops growing at an hour', () => {
		expect([1, 2, 3, 4].map(backoffSeconds)).toEqual([30, 60, 120, 240]);
		expect(backoffSeconds(20)).toBe(3600);
	});
});

describe('sweepEvents', () => {
	it('retries events that are due, oldest first, and leaves the others', async () => {
		const older = await record({ at: t0 });
		const newer = await record({ at: later(10) });
		const notYet = await record({ at: later(10 ** 6) });
		const order: string[] = [];
		const h = handler('h', async (e) => void order.push(e.id));

		const count = await sweepEvents(test.db, [h], later(100));

		expect(count).toBe(2);
		expect(order).toEqual([older, newer]);
		expect((await row(notYet)).processedAt).toBeNull();
	});

	it('picks up an event whose first dispatch never happened, such as a Worker that stopped after commit', async () => {
		const id = await record();
		const h = handler('h');

		await sweepEvents(test.db, [h], later(1));

		expect(h.calls.map((e) => e.id)).toEqual([id]);
	});

	it('waits out the backoff of a failed event, then retries it', async () => {
		const id = await record();
		let broken = true;
		const h = handler('h', async () => {
			if (broken) throw new Error('down');
		});
		await dispatchEvent(test.db, [h], id, t0);

		await sweepEvents(test.db, [h], later(backoffSeconds(1) - 1));
		expect(h.calls).toHaveLength(1); // still waiting

		broken = false;
		await sweepEvents(test.db, [h], later(backoffSeconds(1)));
		expect(h.calls).toHaveLength(2);
		expect((await row(id)).processedAt).not.toBeNull();
	});

	it('ignores events that were processed or given up on', async () => {
		const done = await record();
		await dispatchEvent(test.db, [], done, t0);
		const h = handler('h');

		expect(await sweepEvents(test.db, [h], later(10 ** 7))).toBe(0);
		expect(h.calls).toHaveLength(0);
	});

	it('handles at most the batch size in one run', async () => {
		for (let i = 0; i < 5; i++) await record();

		expect(await sweepEvents(test.db, [], later(1), 3)).toBe(3);
		expect(await sweepEvents(test.db, [], later(1), 3)).toBe(2);
	});
});
