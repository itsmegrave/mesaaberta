import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/test-db';
import { events } from '../db/schema';
import { runSweeper } from './sweeper';
import { recordEvent } from './outbox';
import type { Handler } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());

const log = () => ({
	info: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	child: vi.fn()
});

describe('runSweeper', () => {
	it('does nothing, and opens no connection, when no database is configured', async () => {
		const open = vi.fn();

		const swept = await runSweeper({}, { open, handlers: [], log: log() });

		expect(swept).toBe(0);
		expect(open).not.toHaveBeenCalled();
	});

	it('dispatches the events that are waiting, then closes the connection', async () => {
		const id = await recordEvent(test.db, {
			type: 'TableCreated',
			actorId: null,
			payload: { tableId: 't', slug: 's', title: 'x' }
		});
		const handle = vi.fn();
		const handler: Handler = { name: 'h', types: ['TableCreated'], handle };
		const close = vi.fn();
		const open = vi.fn(() => ({ db: test.db, close }));

		const swept = await runSweeper(
			{ DATABASE_URL: 'postgres://x' },
			{ open: open as never, handlers: [handler], log: log() }
		);

		expect(swept).toBe(1);
		expect(handle).toHaveBeenCalledWith(expect.objectContaining({ id }));
		expect(close).toHaveBeenCalledOnce();
		void events;
	});

	it('closes the connection and reports the error when the sweep itself fails', async () => {
		const close = vi.fn();
		const rejects = () => Promise.reject(new Error('db gone'));
		// select().from().where().orderBy().limit(), the sweep's query, failing at the end
		const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: rejects };
		const broken = { select: () => chain };
		const l = log();

		await expect(
			runSweeper(
				{ DATABASE_URL: 'postgres://x' },
				{ open: (() => ({ db: broken, close })) as never, handlers: [], log: l }
			)
		).rejects.toThrow('db gone');

		expect(close).toHaveBeenCalledOnce();
	});
});
