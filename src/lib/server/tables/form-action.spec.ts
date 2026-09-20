import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden } from '../errors';
import { handleTableForm } from './form-action';
import { createTable } from './write';
import type { TableInput } from '$lib/tables/schema';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = {
	id: '00000000-0000-4000-8000-000000000801',
	role: 'member',
	status: 'active'
} as const;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values({ id: ana.id, displayName: 'Ana' });
});
afterAll(() => test.close());

const fields = (over: Record<string, string | File> = {}) => ({
	systemSlug: 'daggerheart',
	title: 'Mesa Nova',
	description: 'Descrição.',
	kind: 'one_shot',
	capacity: '5',
	startsAtLocal: '2099-10-10T19:00',
	timezone: 'America/Sao_Paulo',
	durationMinutes: '240',
	joinMode: 'auto',
	...over
});

const request = (over: Record<string, string | File> = {}) => {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields(over))) body.set(key, value);
	return new Request('https://x.test/tables/new', { method: 'POST', body });
};

const setup = (
	options: { user?: boolean; put?: ReturnType<typeof vi.fn>; bucket?: boolean } = {}
) => {
	const put = options.put ?? vi.fn().mockResolvedValue({ key: 'stored' });
	const locals = {
		getUser: async () => (options.user === false ? null : { id: ana.id }),
		getProfile: async () => (options.user === false ? null : ana),
		db: test.db
	} as unknown as App.Locals;
	const save = vi.fn(async (input: TableInput, imagePath?: string) =>
		createTable(test.db, ana, input, { imagePath: imagePath ?? null })
	);

	const platform = {
		env: { IMAGES: options.bucket === false ? undefined : { put } }
	} as unknown as App.Platform;

	return { locals, platform, save, put };
};

const run = (req: Request, s: ReturnType<typeof setup>) =>
	handleTableForm(
		{ request: req, locals: s.locals, platform: s.platform, url: new URL(req.url) },
		s.save
	);

describe('handleTableForm', () => {
	it("saves a valid form and goes to the table's own page", async () => {
		const s = setup();

		await expect(run(request(), s)).rejects.toMatchObject({
			status: 303,
			location: '/tables/mesa-nova'
		});
		expect(s.save).toHaveBeenCalledOnce();
	});

	it('sends an anonymous visitor to log in, and saves nothing', async () => {
		const s = setup({ user: false });

		await expect(run(request(), s)).rejects.toMatchObject({
			status: 303,
			location: '/login?next=%2Ftables%2Fnew'
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('answers 400 with every field error and gives the typed values back, saving nothing', async () => {
		const s = setup();

		const result = await run(request({ title: 'x', capacity: '0' }), s);

		expect(result).toMatchObject({
			status: 400,
			data: {
				errors: { title: expect.any(String), capacity: expect.any(String) },
				values: { title: 'x' }
			}
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('stores an uploaded image and saves its path with the table', async () => {
		const s = setup();
		const png = new File([new Uint8Array([...PNG, 1, 2, 3])], 'capa.png', { type: 'image/png' });

		await expect(run(request({ title: 'Com Capa', image: png }), s)).rejects.toMatchObject({
			status: 303
		});

		expect(s.put).toHaveBeenCalledOnce();
		expect(s.save.mock.calls[0][1]).toMatch(/^tables\/[0-9a-f-]{36}\.png$/);
	});

	it('refuses a non-image before anything is uploaded or saved', async () => {
		const s = setup();
		const script = new File(['<script>alert(1)</script>'], 'capa.png', { type: 'image/png' });

		const result = await run(request({ image: script }), s);

		expect(result).toMatchObject({ status: 400, data: { errors: { image: 'not_an_image' } } });
		expect(s.put).not.toHaveBeenCalled();
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not save the table when the upload fails', async () => {
		const s = setup({ put: vi.fn().mockRejectedValue(new Error('no bucket')) });
		const png = new File([new Uint8Array(PNG)], 'capa.png');

		const result = await run(request({ image: png }), s);

		expect(result).toMatchObject({ status: 400, data: { errors: { image: 'upload_failed' } } });
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not save the table when no image bucket is bound', async () => {
		const s = setup({ bucket: false });
		const png = new File([new Uint8Array(PNG)], 'capa.png');

		const result = await run(request({ image: png }), s);

		expect(result).toMatchObject({ status: 400, data: { errors: { image: 'upload_failed' } } });
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not need an image: an empty file field is no upload', async () => {
		const s = setup();

		await expect(
			run(request({ title: 'Sem Capa', image: new File([], '') }), s)
		).rejects.toMatchObject({
			status: 303
		});
		expect(s.put).not.toHaveBeenCalled();
	});

	it('turns a refused permission into a 403 form failure, keeping what was typed', async () => {
		const s = setup();
		s.save.mockRejectedValueOnce(new Forbidden('table:create'));

		const result = await run(request(), s);

		expect(result).toMatchObject({
			status: 403,
			data: { error: 'forbidden', values: { title: 'Mesa Nova' } }
		});
	});
});
