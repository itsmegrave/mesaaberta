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
});
