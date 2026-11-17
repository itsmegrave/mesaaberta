import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { postalCodes } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { lookupCep, withLocation } from '@mesaaberta/core/server/location/cep';
import type { TableInput } from '@mesaaberta/core/tables/schema';

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
      uf: 'PE',
    });

    expect(await lookupCep(test.db, '51020000', fetch)).toEqual({
      status: 'found',
      place: { street: null, neighbourhood: 'Boa Viagem', city: 'Recife', state: 'PE' },
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/51020000/json/',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
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
      place: { street: null, neighbourhood: null, city: 'Triunfo', state: 'PE' },
    });
  });

  it('gives the street the CEP is on, and keeps it', async () => {
    const fetch = answer({
      logradouro: ' Avenida Boa Viagem ',
      bairro: 'Boa Viagem',
      localidade: 'Recife',
      uf: 'PE',
    });
    const found = {
      status: 'found',
      place: {
        street: 'Avenida Boa Viagem',
        neighbourhood: 'Boa Viagem',
        city: 'Recife',
        state: 'PE',
      },
    };
    expect(await lookupCep(test.db, '51021000', fetch)).toEqual(found);
    const again = answer({});
    expect(await lookupCep(test.db, '51021000', again)).toEqual(found);
    expect(again).not.toHaveBeenCalled();
  });

  it('asks ViaCEP once more for the street of a CEP kept before streets were', async () => {
    await test.db
      .insert(postalCodes)
      .values({ cep: '50030230', neighbourhood: 'Recife', city: 'Recife', state: 'PE' });

    // ViaCEP down: still found, without a street, and asked again next time.
    expect(await lookupCep(test.db, '50030230', answer({}, 500))).toEqual({
      status: 'found',
      place: { street: null, neighbourhood: 'Recife', city: 'Recife', state: 'PE' },
    });

    const fetch = answer({
      logradouro: 'Rua do Bom Jesus',
      bairro: 'Recife',
      localidade: 'Recife',
      uf: 'PE',
    });
    expect(await lookupCep(test.db, '50030230', fetch)).toMatchObject({
      place: { street: 'Rua do Bom Jesus' },
    });
    const [row] = await test.db.select().from(postalCodes).where(eq(postalCodes.cep, '50030230'));
    expect(row?.street).toBe('Rua do Bom Jesus');
  });

  it('keeps a town-wide CEP as having no street, and does not ask again', async () => {
    expect(
      await lookupCep(
        test.db,
        '56880000',
        answer({ logradouro: '', localidade: 'Afogados', uf: 'PE' }),
      ),
    ).toMatchObject({ place: { street: null } });
    const again = answer({});
    expect(await lookupCep(test.db, '56880000', again)).toMatchObject({ place: { street: null } });
    expect(again).not.toHaveBeenCalled();
  });

  it('says a CEP does not exist, and keeps nothing', async () => {
    const fetch = answer({ erro: 'true' });
    expect(await lookupCep(test.db, '99999999', fetch)).toEqual({ status: 'not_found' });
    expect(await test.db.select().from(postalCodes).where(eq(postalCodes.cep, '99999999'))).toEqual(
      [],
    );
  });

  it('says the service is unavailable when it fails or answers something unexpected', async () => {
    expect(await lookupCep(test.db, '01001000', answer({}, 500))).toEqual({
      status: 'unavailable',
    });
    expect(
      await lookupCep(
        test.db,
        '01001000',
        vi.fn(async () => Promise.reject(new Error('timeout'))),
      ),
    ).toEqual({ status: 'unavailable' });
    expect(await lookupCep(test.db, '01001000', answer({ localidade: '' }))).toEqual({
      status: 'unavailable',
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
      ...over,
    }) as TableInput;
  const recife = answer({ bairro: 'Graças', localidade: 'Recife', uf: 'PE' });

  it('fills the place from the CEP, and the area when none was typed', async () => {
    expect(await withLocation(test.db, input(), recife)).toMatchObject({
      locationArea: 'Graças, Recife - PE',
      locationNeighbourhood: 'Graças',
      locationCity: 'Recife',
      locationState: 'PE',
    });
    expect(
      await withLocation(test.db, input({ locationArea: 'Perto do metrô' }), recife),
    ).toMatchObject({ locationArea: 'Perto do metrô', locationCity: 'Recife' });
  });

  it('leaves a table without CEP alone', async () => {
    const plain = input({ postalCode: null, locationArea: 'Olinda' });
    expect(await withLocation(test.db, plain, answer({}))).toBe(plain);
  });

  it('refuses a CEP that does not exist', async () => {
    await expect(
      withLocation(test.db, input({ postalCode: '00000001' }), answer({ erro: true })),
    ).rejects.toMatchObject({ field: 'postalCode', message: 'not_found' });
  });

  it('saves anyway when ViaCEP is down and there is an area, and asks for one otherwise', async () => {
    const down = answer({}, 503);
    expect(
      await withLocation(test.db, input({ postalCode: '00000002', locationArea: 'Olinda' }), down),
    ).toMatchObject({ locationArea: 'Olinda', locationCity: null });
    await expect(
      withLocation(test.db, input({ postalCode: '00000002' }), down),
    ).rejects.toMatchObject({ field: 'postalCode', message: 'unavailable' });
  });
});
