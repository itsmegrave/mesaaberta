import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUpcomingTables } from '$lib/server/tables/queries';
import { load } from './+page.server';

vi.mock('$lib/server/tables/queries', () => ({ listUpcomingTables: vi.fn() }));

const listed = vi.mocked(listUpcomingTables);

const table = (n: number) =>
	({
		slug: `mesa-${n}`,
		title: `Mesa ${n}`,
		gmId: `gm-${n}`,
		imagePath: null
	}) as unknown as Awaited<ReturnType<typeof listUpcomingTables>>[number];

const error = vi.fn();
const event = (db: unknown = {}) =>
	({ locals: { db, log: { error } }, platform: undefined }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the home page load', () => {
	beforeEach(() => {
		listed.mockReset();
		error.mockReset();
	});

	it('lists nothing when there is no database yet', async () => {
		expect(await run(event(null))).toEqual({ tables: [] });
		expect(listed).not.toHaveBeenCalled();
	});

	it('previews the three soonest tables, keeping the GM id on the server', async () => {
		listed.mockResolvedValue([1, 2, 3, 4].map(table));

		const { tables } = await run(event());

		expect(tables.map((t: { slug: string }) => t.slug)).toEqual(['mesa-1', 'mesa-2', 'mesa-3']);
		expect(tables[0]).not.toHaveProperty('gmId');
		expect(tables[0]).not.toHaveProperty('imagePath');
	});

	it('still renders, without the preview, when the tables cannot be listed', async () => {
		listed.mockRejectedValue(new Error('down'));

		expect(await run(event())).toEqual({ tables: [] });
		expect(error).toHaveBeenCalledOnce();
	});
});
