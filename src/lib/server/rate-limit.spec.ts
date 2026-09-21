import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { events, profiles } from './db/schema';
import { createTestDb } from './db/test-db';
import { RateLimited } from './errors';
import {
	JOIN_LIMIT,
	TABLE_CREATION_LIMIT,
	checkRateLimit,
	enforceRateLimit,
	type RateLimit
} from './rate-limit';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000a01';
const bruno = '00000000-0000-4000-8000-000000000a02';
const now = new Date('2026-10-01T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const limit: RateLimit = { events: ['TableCreated'], max: 3, windowSeconds: 3600 };

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: ana, displayName: 'Ana' },
		{ id: bruno, displayName: 'Bruno' }
	]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(events));

const record = (actorId: string | null, type: string, createdAt: Date) =>
	test.db.insert(events).values({ type, actorId, payload: {}, createdAt });

const created = (actorId: string, ...agesInMinutes: number[]) =>
	Promise.all(agesInMinutes.map((age) => record(actorId, 'TableCreated', minutesAgo(age))));

const retryAfterOf = async (promise: Promise<unknown>) => {
	const error = await promise.then(
		() => undefined,
		(e: unknown) => e
	);
	expect(error).toBeInstanceOf(RateLimited);

	return (error as RateLimited).retryAfterSeconds;
};

describe('the named limits', () => {
	it('lets a person open 5 tables an hour', () => {
		expect(TABLE_CREATION_LIMIT).toEqual({ events: ['TableCreated'], max: 5, windowSeconds: 3600 });
	});

	it('lets a person join 20 tables an hour, whether they took a seat or asked for one', () => {
		expect(JOIN_LIMIT).toEqual({
			events: ['PlayerJoined', 'JoinRequested'],
			max: 20,
			windowSeconds: 3600
		});
	});
});

describe('enforceRateLimit', () => {
	it('lets a request through while the person is under the limit', async () => {
		await created(ana, 10, 20);

		await expect(enforceRateLimit(test.db, ana, limit, now)).resolves.toBeUndefined();
	});

	it('refuses once the person has used the whole limit', async () => {
		await created(ana, 10, 20, 30);

		await expect(enforceRateLimit(test.db, ana, limit, now)).rejects.toBeInstanceOf(RateLimited);
	});

	it('tells when the oldest counted event leaves the window, rounded up to the second', async () => {
		// Used 50, 20 and 10 minutes ago: the 50-minute-old one frees a slot in 10 minutes.
		await created(ana, 50, 20, 10);
		expect(await retryAfterOf(enforceRateLimit(test.db, ana, limit, now))).toBe(600);

		await test.db.delete(events);
		await record(ana, 'TableCreated', new Date(now.getTime() - 3_599_500));
		await created(ana, 20, 10);
		expect(await retryAfterOf(enforceRateLimit(test.db, ana, limit, now))).toBe(1);
	});

	it('waits for the event that brings the count under the limit, not the oldest one', async () => {
		// Four in the window with a limit of 3: two must expire, so the second oldest decides.
		await created(ana, 55, 40, 20, 10);

		expect(await retryAfterOf(enforceRateLimit(test.db, ana, limit, now))).toBe(20 * 60);
	});

	it('has an event leave the window exactly one window after it happened', async () => {
		await created(ana, 20, 10);
		await record(ana, 'TableCreated', new Date(now.getTime() - 3_600_000));
		// Exactly one hour old: no longer counted, so only two are in the window.
		await expect(enforceRateLimit(test.db, ana, limit, now)).resolves.toBeUndefined();

		await test.db.delete(events);
		await created(ana, 20, 10);
		await record(ana, 'TableCreated', new Date(now.getTime() - 3_599_999));
		// One millisecond younger: still counted.
		await expect(enforceRateLimit(test.db, ana, limit, now)).rejects.toBeInstanceOf(RateLimited);
	});

	it('ignores events older than the window', async () => {
		await created(ana, 61, 120, 600);

		await expect(enforceRateLimit(test.db, ana, limit, now)).resolves.toBeUndefined();
	});

	it('counts each person on their own', async () => {
		await created(ana, 10, 20, 30);

		await expect(enforceRateLimit(test.db, bruno, limit, now)).resolves.toBeUndefined();
	});

	it('counts only the event types the limit names', async () => {
		await record(ana, 'TableUpdated', minutesAgo(5));
		await record(ana, 'TableDisabled', minutesAgo(5));
		await record(ana, 'PlayerJoined', minutesAgo(5));
		await created(ana, 10, 20);

		await expect(enforceRateLimit(test.db, ana, limit, now)).resolves.toBeUndefined();
	});

	it('counts every type a limit names together', async () => {
		const joins: RateLimit = {
			events: ['PlayerJoined', 'JoinRequested'],
			max: 2,
			windowSeconds: 60
		};
		await record(ana, 'PlayerJoined', new Date(now.getTime() - 10_000));
		await record(ana, 'JoinRequested', new Date(now.getTime() - 5_000));

		expect(await retryAfterOf(enforceRateLimit(test.db, ana, joins, now))).toBe(50);
	});

	it('does not record anything, whether it lets the request through or refuses it', async () => {
		await created(ana, 10, 20);
		await enforceRateLimit(test.db, ana, limit, now);
		await created(ana, 30);
		await enforceRateLimit(test.db, ana, limit, now).catch(() => undefined);

		expect(await test.db.select().from(events)).toHaveLength(3);
	});
});

describe('checkRateLimit', () => {
	it('gives the same answer as enforceRateLimit, for a cheap look before costly work', async () => {
		await created(ana, 20, 10);
		await expect(checkRateLimit(test.db, ana, limit, now)).resolves.toBeUndefined();

		await created(ana, 30);
		expect(await retryAfterOf(checkRateLimit(test.db, ana, limit, now))).toBe(30 * 60);
	});

	it('counts each person on their own', async () => {
		await created(ana, 10, 20, 30);

		await expect(checkRateLimit(test.db, bruno, limit, now)).resolves.toBeUndefined();
	});
});
