import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { postalCodes } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { lookupCep, withLocation } from './cep';
import type { TableInput } from '$lib/tables/schema';

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());

const answer = (body: unknown, status = 200) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('lookupCep', () => {
	it('asks ViaCEP once, keeps the answer, and serves the next lookup from the database', async () => {
		const fetch = answer({
			cep: '51020-000',
			bairro: 'Boa Viagem',
			localidade: 'Recife',
			uf: 'PE'
		});

		expect(await lookupCep(test.db, '51020000', fetch)).toEqual({
			status: 'found',
			place: { neighbourhood: 'Boa Viagem', city: 'Recife', state: 'PE' }
		});
		expect(fetch).toHaveBeenCalledWith(
			'https://viacep.com.br/ws/51020000/json/',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);

		const again = answer({});
		expect(await lookupCep(test.db, '51020000', again)).toMatchObject({ status: 'found' });
		expect(again).not.toHaveBeenCalled();
		const [row] = await test.db.select().from(postalCodes).where(eq(postalCodes.cep, '51020000'));
		expect(row).toMatchObject({ city: 'Recife', state: 'PE' });
	});

	it('keeps an empty neighbourhood as none (small towns have a single CEP)', async () => {
		const fetch = answer({ bairro: '', localidade: 'Triunfo', uf: 'PE' });
		expect(await lookupCep(test.db, '56870000', fetch)).toEqual({
			status: 'found',
			place: { neighbourhood: null, city: 'Triunfo', state: 'PE' }
		});
	});

	it('says a CEP does not exist, and keeps nothing', async () => {
		const fetch = answer({ erro: 'true' });
		expect(await lookupCep(test.db, '99999999', fetch)).toEqual({ status: 'not_found' });
		expect(await test.db.select().from(postalCodes).where(eq(postalCodes.cep, '99999999'))).toEqual(
			[]
		);
	});

	it('says the service is unavailable when it fails or answers something unexpected', async () => {
		expect(await lookupCep(test.db, '01001000', answer({}, 500))).toEqual({
			status: 'unavailable'
		});
		expect(
			await lookupCep(
				test.db,
				'01001000',
				vi.fn(async () => Promise.reject(new Error('timeout')))
			)
		).toEqual({ status: 'unavailable' });
		expect(await lookupCep(test.db, '01001000', answer({ localidade: '' }))).toEqual({
			status: 'unavailable'
		});
	});
});

describe('withLocation', () => {
	const input = (over: Partial<TableInput> = {}) =>
		({
			modality: 'in_person',
			locationArea: null,
			postalCode: '52011000',
			locationNeighbourhood: null,
			locationCity: null,
			locationState: null,
			...over
		}) as TableInput;
	const recife = answer({ bairro: 'Graças', localidade: 'Recife', uf: 'PE' });

	it('fills the place from the CEP, and the area when none was typed', async () => {
		expect(await withLocation(test.db, input(), recife)).toMatchObject({
			locationArea: 'Graças, Recife - PE',
			locationNeighbourhood: 'Graças',
			locationCity: 'Recife',
			locationState: 'PE'
		});
		expect(
			await withLocation(test.db, input({ locationArea: 'Perto do metrô' }), recife)
		).toMatchObject({ locationArea: 'Perto do metrô', locationCity: 'Recife' });
	});

	it('leaves a table without CEP alone', async () => {
		const plain = input({ postalCode: null, locationArea: 'Olinda' });
		expect(await withLocation(test.db, plain, answer({}))).toBe(plain);
	});

	it('refuses a CEP that does not exist', async () => {
		await expect(
			withLocation(test.db, input({ postalCode: '00000001' }), answer({ erro: true }))
		).rejects.toMatchObject({ field: 'postalCode', message: 'not_found' });
	});

	it('saves anyway when ViaCEP is down and there is an area, and asks for one otherwise', async () => {
		const down = answer({}, 503);
		expect(
			await withLocation(test.db, input({ postalCode: '00000002', locationArea: 'Olinda' }), down)
		).toMatchObject({ locationArea: 'Olinda', locationCity: null });
		await expect(
			withLocation(test.db, input({ postalCode: '00000002' }), down)
		).rejects.toMatchObject({ field: 'postalCode', message: 'unavailable' });
	});
});
