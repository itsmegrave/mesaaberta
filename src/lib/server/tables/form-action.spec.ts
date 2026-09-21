import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, Invalid, RateLimited } from '../errors';
import { handleTableForm } from './form-action';
import { createTable } from './write';
import type { TableInput } from '$lib/tables/schema';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = {
	id: '00000000-0000-4000-8000-000000000801',
	username: 'ana',
	role: 'member',
	status: 'active'
} as const;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values({ id: ana.id, username: 'ana' });
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

const setup = (options: { user?: boolean; upload?: ReturnType<typeof vi.fn> } = {}) => {
	const upload = options.upload ?? vi.fn().mockResolvedValue({ error: null });
	const locals = {
		getUser: async () => (options.user === false ? null : { id: ana.id }),
		getProfile: async () => (options.user === false ? null : ana),
		supabase: { storage: { from: () => ({ upload }) } },
		db: test.db
	} as unknown as App.Locals;
	const save = vi.fn(async (input: TableInput, imagePath?: string) =>
		createTable(test.db, ana, input, { imagePath: imagePath ?? null })
	);

	const setHeaders = vi.fn();
	const guard = vi.fn(async () => {});

	return { locals, save, upload, setHeaders, guard };
};

const run = (req: Request, s: ReturnType<typeof setup>) =>
	handleTableForm(
		{ request: req, locals: s.locals, url: new URL(req.url), setHeaders: s.setHeaders },
		s.save,
		s.guard
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

	it('sends someone who has not picked a username yet to finish the profile, saving nothing', async () => {
		const s = setup();
		s.locals.getProfile = async () => ({ ...ana, username: null }) as never;

		await expect(run(request(), s)).rejects.toMatchObject({
			status: 303,
			location: '/onboarding?next=%2Ftables%2Fnew'
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('answers 400 with every field error and gives the typed values back, saving nothing', async () => {
		const s = setup();

		const result = await run(request({ title: 'x', capacity: '0' }), s);

		expect(result).toMatchObject({
			status: 400,
			data: {
				form: {
					errors: { title: expect.any(Array), capacity: expect.any(Array) },
					data: { title: 'x' }
				}
			}
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('hands the welcome message to save, and keeps it when the form is refused', async () => {
		const s = setup();
		await expect(
			run(request({ title: 'Boas-vindas', welcomeMessage: 'Olá, {nome da mesa}!' }), s)
		).rejects.toMatchObject({ status: 303 });
		expect(s.save.mock.calls[0][0]).toMatchObject({ welcomeMessage: 'Olá, {nome da mesa}!' });

		const refused = await run(request({ title: 'x', welcomeMessage: 'Fale comigo.' }), setup());
		expect(refused).toMatchObject({
			status: 400,
			data: { values: { welcomeMessage: 'Fale comigo.' } }
		});
	});

	it('refuses a welcome message over the limit and gives the typed text back', async () => {
		const s = setup();
		const long = 'x'.repeat(1001);

		const result = await run(request({ welcomeMessage: long }), s);

		expect(result).toMatchObject({
			status: 400,
			data: { errors: { welcomeMessage: 'too_big' }, values: { welcomeMessage: long } }
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('stores an uploaded image and saves its path with the table', async () => {
		const s = setup();
		const png = new File([new Uint8Array([...PNG, 1, 2, 3])], 'capa.png', { type: 'image/png' });

		await expect(run(request({ title: 'Com Capa', image: png }), s)).rejects.toMatchObject({
			status: 303
		});

		expect(s.upload).toHaveBeenCalledOnce();
		expect(s.save.mock.calls[0][1]).toMatch(/^tables\/[0-9a-f-]{36}\.png$/);
	});

	it('refuses a non-image before anything is uploaded or saved', async () => {
		const s = setup();
		const script = new File(['<script>alert(1)</script>'], 'capa.png', { type: 'image/png' });

		const result = await run(request({ image: script }), s);

		expect(result).toMatchObject({
			status: 400,
			data: { form: { message: { code: 'not_an_image', field: 'image' } } }
		});
		expect(s.upload).not.toHaveBeenCalled();
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not save the table when the upload fails', async () => {
		const s = setup({ upload: vi.fn().mockResolvedValue({ error: { message: 'no bucket' } }) });
		const png = new File([new Uint8Array(PNG)], 'capa.png');

		const result = await run(request({ image: png }), s);

		expect(result).toMatchObject({
			status: 400,
			data: { form: { message: { code: 'upload_failed', field: 'image' } } }
		});
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not need an image: an empty file field is no upload', async () => {
		const s = setup();

		await expect(
			run(request({ title: 'Sem Capa', image: new File([], '') }), s)
		).rejects.toMatchObject({
			status: 303
		});
		expect(s.upload).not.toHaveBeenCalled();
	});

	it('turns a refused permission into a 403 form failure, keeping what was typed', async () => {
		const s = setup();
		s.save.mockRejectedValueOnce(new Forbidden('table:create'));

		const result = await run(request(), s);

		expect(result).toMatchObject({
			status: 403,
			data: { form: { message: { code: 'forbidden' }, data: { title: 'Mesa Nova' } } }
		});
	});

	it('turns RateLimited into a 429 with the wait, keeping what was typed, and sets Retry-After', async () => {
		const s = setup();
		s.save.mockRejectedValueOnce(new RateLimited(900));

		const result = await run(request(), s);

		expect(result).toMatchObject({
			status: 429,
			data: {
				form: { message: { code: 'rate_limited', retryAfter: 900 }, data: { title: 'Mesa Nova' } }
			}
		});
		expect(s.setHeaders).toHaveBeenCalledWith({ 'Retry-After': '900' });
	});

	it('asks the guard before storing the image, so a limited request uploads nothing', async () => {
		const s = setup();
		s.guard.mockRejectedValueOnce(new RateLimited(60));
		const png = new File([new Uint8Array([...PNG, 0, 0, 0, 0])], 'capa.png', { type: 'image/png' });

		const result = await run(request({ image: png }), s);

		expect(result).toMatchObject({
			status: 429,
			data: { form: { message: { code: 'rate_limited', retryAfter: 60 } } }
		});
		expect(s.upload).not.toHaveBeenCalled();
		expect(s.save).not.toHaveBeenCalled();
	});

	it('does not ask the guard about a form that is invalid anyway', async () => {
		const s = setup();

		await run(request({ title: '' }), s);

		expect(s.guard).not.toHaveBeenCalled();
	});

	it('puts a domain problem on the field it names', async () => {
		const s = setup();
		s.save.mockRejectedValueOnce(new Invalid('systemSlug'));

		const result = await run(request(), s);

		expect(result).toMatchObject({
			status: 400,
			data: { form: { errors: { systemSlug: ['invalid'] } } }
		});
	});
});
