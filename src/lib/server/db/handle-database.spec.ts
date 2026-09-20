import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { connectionStringFrom } from './client';
import { handleDatabase } from './handle-database';

const local = 'postgres://user:pass@localhost:5432/mesaaberta';
const hyperdrive = 'postgres://user:pass@hyperdrive.example:5432/mesaaberta';

describe('connectionStringFrom', () => {
	it('prefers the Hyperdrive binding over DATABASE_URL', () => {
		expect(
			connectionStringFrom({ HYPERDRIVE: { connectionString: hyperdrive }, DATABASE_URL: local })
		).toBe(hyperdrive);
	});

	it('falls back to DATABASE_URL, and to nothing at all', () => {
		expect(connectionStringFrom({ DATABASE_URL: local })).toBe(local);
		expect(connectionStringFrom({})).toBeUndefined();
		expect(connectionStringFrom(undefined)).toBeUndefined();
	});

	it('treats an empty DATABASE_URL as not configured', () => {
		expect(connectionStringFrom({ DATABASE_URL: '' })).toBeUndefined();
	});
});

describe('handleDatabase', () => {
	const run = async (env: object | undefined, read: (event: RequestEvent) => void) => {
		const waitUntil = vi.fn();
		const event = {
			locals: {},
			platform: env && { env, ctx: { waitUntil } }
		} as unknown as RequestEvent;

		await handleDatabase({
			event,
			resolve: async () => {
				read(event);
				return new Response();
			}
		});

		return waitUntil;
	};

	it('gives routes a null database when none is configured', async () => {
		let db: unknown = 'unset';

		await run({}, (event) => (db = event.locals.db));

		expect(db).toBeNull();
	});

	it('gives routes one database per request, however often they read it', async () => {
		const reads: unknown[] = [];

		await run({ DATABASE_URL: local }, (event) => reads.push(event.locals.db, event.locals.db));

		expect(reads[0]).toBeTruthy();
		expect(reads[0]).toBe(reads[1]);
	});

	it('closes the connection after the response, only when a route used it', async () => {
		const used = await run({ DATABASE_URL: local }, (event) => void event.locals.db);
		const unused = await run({ DATABASE_URL: local }, () => {});

		expect(used).toHaveBeenCalledOnce();
		expect(unused).not.toHaveBeenCalled();
	});

	describe('afterResponse', () => {
		const run = async (env: object, body: (event: RequestEvent) => void) => {
			const waiting: Promise<unknown>[] = [];
			const log = { error: vi.fn() };
			const event = {
				locals: { log },
				platform: { env, ctx: { waitUntil: (p: Promise<unknown>) => waiting.push(p) } }
			} as unknown as RequestEvent;

			await handleDatabase({
				event,
				resolve: async () => {
					body(event);
					return new Response();
				}
			});
			await Promise.all(waiting);

			return { log, waiting };
		};

		it("runs a task after the response, with this request's database", async () => {
			const seen: unknown[] = [];

			await run({ DATABASE_URL: local }, (event) =>
				event.locals.afterResponse(async (db) => void seen.push(db))
			);

			expect(seen).toHaveLength(1);
			expect(seen[0]).toBeTruthy();
		});

		it('gives every task the same database, and keeps it open until they have all finished', async () => {
			const order: string[] = [];
			const dbs: unknown[] = [];

			await run({ DATABASE_URL: local }, (event) => {
				event.locals.afterResponse(async (db) => {
					dbs.push(db);
					await new Promise((resolve) => setTimeout(resolve, 20));
					order.push('slow done');
				});
				event.locals.afterResponse(async (db) => void dbs.push(db));
			});
			order.push('closed');

			expect(dbs[0]).toBe(dbs[1]);
			expect(order).toEqual(['slow done', 'closed']);
		});

		it('logs a failing task instead of throwing, and still runs the others', async () => {
			const ran = vi.fn();

			const { log } = await run({ DATABASE_URL: local }, (event) => {
				event.locals.afterResponse(async () => {
					throw new Error('boom');
				});
				event.locals.afterResponse(async () => ran());
			});

			expect(ran).toHaveBeenCalledOnce();
			expect(log.error).toHaveBeenCalledOnce();
		});

		it('drops the task when there is no database, since there is nothing to run it against', async () => {
			const task = vi.fn();

			await run({}, (event) => event.locals.afterResponse(task));

			expect(task).not.toHaveBeenCalled();
		});
	});
});
