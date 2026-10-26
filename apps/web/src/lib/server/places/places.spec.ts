import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PlaceInput } from '@mesaaberta/core/places/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  placeLinks,
  places,
  placeTags,
  postalCodes,
  profiles,
  reports,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { approvePlace, pendingPlaceCount, removePlace } from '@mesaaberta/core/server/places/admin';
import {
  findEditablePlace,
  PlaceDuplicate,
  submitPlace,
  updatePlace,
  withdrawPlace,
} from '@mesaaberta/core/server/places/service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-26T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);

// ViaCEP is never reached: every CEP the tests use is in the cache, except the ones below.
const viacep = vi.fn<typeof fetch>(async () => Response.json({ erro: true }));

const input = (over: Partial<PlaceInput> = {}): PlaceInput => ({
  name: 'Taverna do Dado',
  kind: 'game_cafe',
  postalCode: '51020-000',
  street: 'Av. Boa Viagem, 100',
  complement: '',
  description: 'Mesas toda sexta',
  openingHours: 'Ter a dom, 14h às 23h',
  amenities: ['free_to_play', 'accessible'],
  siteUrl: '',
  linkNetwork: ['instagram'],
  linkUrl: ['@tavernadodado'],
  removeImage: false,
  ...over,
});
const send = (over: Partial<PlaceInput> = {}, actor: Actor = ana) =>
  submitPlace(test.db, actor, input(over), { now, request: viacep });
const placeAt = async (placeId: string) =>
  (await test.db.select().from(places).where(eq(places.id, placeId)))[0];
const tagsOf = async (placeId: string) =>
  (await test.db.select().from(placeTags).where(eq(placeTags.placeId, placeId)))
    .map((tag) => `${tag.kind}:${tag.slug}`)
    .sort();

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
  await test.db
    .insert(postalCodes)
    .values([
      { cep: '51020000', neighbourhood: 'Boa Viagem', city: 'Recife', state: 'PE' },
      { cep: '01001000', neighbourhood: 'Sé', city: 'São Paulo', state: 'SP' },
    ])
    .onConflictDoNothing();
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(reports);
  await test.db.delete(places);
  await test.db.delete(events);
  viacep.mockClear();
});

describe('sending a place', () => {
  it('waits for an admin, with the address the CEP resolves to and no tags yet', async () => {
    const { id: placeId, slug } = await send();
    expect(slug).toBe('taverna-do-dado');
    const row = await placeAt(placeId);
    expect(row).toMatchObject({
      submitterId: ana.id,
      postalCode: '51020000',
      neighbourhood: 'Boa Viagem',
      city: 'Recife',
      state: 'PE',
      amenities: ['accessible', 'free_to_play'],
      approvedAt: null,
    });
    expect(await tagsOf(placeId)).toEqual([]);
    expect(await pendingPlaceCount(test.db)).toBe(1);
    const links = await test.db.select().from(placeLinks).where(eq(placeLinks.placeId, placeId));
    expect(links.map((link) => link.url)).toEqual(['https://instagram.com/tavernadodado']);
    const [event] = await test.db.select().from(events);
    expect(event).toMatchObject({ type: 'PlaceSubmitted', actorId: ana.id });
  });

  it('refuses the same name at the same CEP, linking to it only for whoever may open it', async () => {
    const first = await send();
    const again = await send({ name: 'TAVERNA DO DADO' }, bruno).catch((error) => error);
    expect(again).toBeInstanceOf(PlaceDuplicate);
    expect(again).toMatchObject({ field: 'name', message: 'place_duplicate', slug: null });

    const mine = await send({ name: 'Taverna do dado' }).catch((error) => error);
    expect(mine).toMatchObject({ slug: 'taverna-do-dado' });

    await approvePlace(test.db, admin, first.id, { now });
    expect(await send({}, bruno).catch((error) => error)).toMatchObject({
      slug: 'taverna-do-dado',
    });
  });

  it('takes the same name elsewhere, under the next free slug', async () => {
    await send();
    const other = await send({ postalCode: '01001-000' }, bruno);
    expect(other.slug).toBe('taverna-do-dado-2');
  });

  it('allows the name again once the first one was removed', async () => {
    const first = await send();
    await removePlace(test.db, admin, first.id, { reason: 'place_closed', note: '' }, { now });
    await expect(send()).resolves.toMatchObject({ slug: 'taverna-do-dado-2' });
  });

  it('refuses a CEP that does not exist, or one ViaCEP cannot look up now', async () => {
    await expect(send({ postalCode: '99999-999' })).rejects.toMatchObject({
      field: 'postalCode',
      message: 'not_found',
    });
    viacep.mockRejectedValueOnce(new Error('down'));
    await expect(send({ postalCode: '88888-888' })).rejects.toMatchObject({
      field: 'postalCode',
      message: 'unavailable',
    });
  });

  it('never takes the slug of the form', async () => {
    await expect(send({ name: 'New' })).resolves.toMatchObject({ slug: 'new-2' });
  });
});

describe('approving', () => {
  it('is for admins only', async () => {
    const { id: placeId } = await send();
    await expect(approvePlace(test.db, ana, placeId, { now })).rejects.toThrow(Forbidden);
    await expect(approvePlace(test.db, bruno, placeId, { now })).rejects.toThrow(Forbidden);
  });

  it('puts it up with tags from its address, kind and amenities, and tells the submitter', async () => {
    const { id: placeId } = await send();
    await approvePlace(test.db, admin, placeId, { now });
    expect((await placeAt(placeId)).approvedAt).toEqual(now);
    expect(await tagsOf(placeId)).toEqual([
      'amenity:accessible',
      'amenity:free-to-play',
      'city:pe-recife',
      'kind:game-cafe',
      'neighbourhood:pe-recife-boa-viagem',
      'state:pe',
    ]);
    const approved = (await test.db.select().from(events)).find(
      (event) => event.type === 'PlaceApproved',
    );
    expect(approved?.payload).toMatchObject({ placeId, submitterId: ana.id });
    await expect(approvePlace(test.db, admin, placeId, { now })).rejects.toMatchObject({
      message: 'already_approved',
    });
  });
});

describe('editing', () => {
  it("sends the submitter's edit back to review and drops its tags", async () => {
    const { id: placeId } = await send();
    await approvePlace(test.db, admin, placeId, { now });
    const { pending } = await updatePlace(
      test.db,
      ana,
      placeId,
      input({ openingHours: 'Todos os dias' }),
      { now, request: viacep },
    );
    expect(pending).toBe(true);
    expect((await placeAt(placeId)).approvedAt).toBeNull();
    expect(await tagsOf(placeId)).toEqual([]);
  });

  it("keeps an admin's edit up and rebuilds the tags from the new address", async () => {
    const { id: placeId } = await send();
    await approvePlace(test.db, admin, placeId, { now });
    await updatePlace(
      test.db,
      admin,
      placeId,
      input({ postalCode: '01001000', kind: 'store', amenities: [] }),
      { now, request: viacep },
    );
    const row = await placeAt(placeId);
    expect(row).toMatchObject({ city: 'São Paulo', state: 'SP', kind: 'store' });
    expect(row.approvedAt).toEqual(now);
    expect(await tagsOf(placeId)).toEqual([
      'city:sp-sao-paulo',
      'kind:store',
      'neighbourhood:sp-sao-paulo-se',
      'state:sp',
    ]);
    const updated = (await test.db.select().from(events)).find(
      (event) => event.type === 'PlaceUpdated',
    );
    expect(updated?.payload).toMatchObject({
      changes: {
        city: { from: 'Recife', to: 'São Paulo' },
        kind: { from: 'game_cafe', to: 'store' },
      },
    });
  });

  it("keeps an approved owner's edit up", async () => {
    const { id: placeId } = await send({}, bruno);
    await approvePlace(test.db, admin, placeId, { now });
    await test.db
      .update(places)
      .set({ ownerId: ana.id, ownerSince: now })
      .where(eq(places.id, placeId));
    const { pending } = await updatePlace(test.db, ana, placeId, input({ description: 'Nova' }), {
      now,
      request: viacep,
    });
    expect(pending).toBe(false);
    expect((await placeAt(placeId)).approvedAt).toEqual(now);
  });

  it('is refused to anyone else, and the form will not open for them', async () => {
    const { id: placeId, slug } = await send();
    await expect(
      updatePlace(test.db, bruno, placeId, input(), { now, request: viacep }),
    ).rejects.toThrow(Forbidden);
    await expect(findEditablePlace(test.db, bruno, slug)).rejects.toThrow(Forbidden);
    await expect(findEditablePlace(test.db, ana, slug)).resolves.toMatchObject({
      name: 'Taverna do Dado',
      links: [{ network: 'instagram', url: 'https://instagram.com/tavernadodado' }],
    });
  });

  it('refuses a name and CEP another place already has', async () => {
    await send();
    const { id: placeId } = await send({ name: 'Outro Lugar' });
    await expect(
      updatePlace(test.db, ana, placeId, input(), { now, request: viacep }),
    ).rejects.toThrow(PlaceDuplicate);
  });

  it('takes the photo off, and returns the replaced path', async () => {
    const { id: placeId } = await submitPlace(test.db, ana, input(), {
      now,
      request: viacep,
      imagePath: 'places/a.webp',
    });
    const replaced = await updatePlace(test.db, ana, placeId, input({ removeImage: true }), {
      now,
      request: viacep,
    });
    expect(replaced.replacedImage).toBe('places/a.webp');
    expect((await placeAt(placeId)).imagePath).toBeNull();
  });
});

describe('taking a place off', () => {
  it('lets its submitter withdraw it, and nobody else', async () => {
    const { id: placeId } = await send();
    await expect(withdrawPlace(test.db, bruno, placeId, { now })).rejects.toThrow(Forbidden);
    await withdrawPlace(test.db, ana, placeId, { now });
    expect((await placeAt(placeId)).removedAt).toEqual(now);
    await expect(withdrawPlace(test.db, ana, placeId, { now })).rejects.toThrow(NotFound);
  });

  it('lets an admin reject or remove it with a reason, and clears its tags', async () => {
    const { id: placeId } = await send();
    await approvePlace(test.db, admin, placeId, { now });
    await removePlace(
      test.db,
      admin,
      placeId,
      { reason: 'wrong_address', note: ' mudou ' },
      { now },
    );
    expect(await placeAt(placeId)).toMatchObject({
      removalReason: 'wrong_address',
      removalNote: 'mudou',
    });
    expect(await tagsOf(placeId)).toEqual([]);
    await expect(
      removePlace(test.db, admin, placeId, { reason: 'spam', note: '' }, { now }),
    ).rejects.toThrow(Invalid);
  });
});
