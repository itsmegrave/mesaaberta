import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  placeClaims,
  places,
  postalCodes,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { approvePlace } from '@mesaaberta/core/server/places/admin';
import {
  approveClaim,
  fileClaim,
  listClaims,
  pendingClaimCount,
  pendingClaimOf,
  rejectClaim,
  removePlaceOwner,
} from '@mesaaberta/core/server/places/claims';
import { placeAlertHandler } from '@mesaaberta/core/server/events/place-alerts';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { submitPlace } from '@mesaaberta/core/server/places/service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-26T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);
const carla = member(3);
const viacep = vi.fn<typeof fetch>(async () => Response.json({ erro: true }));
const claim = {
  relation: 'owner' as const,
  contact: 'loja@taverna.test',
  note: '',
  confirm: true as const,
};

const listed = async () => {
  const { id: placeId, slug } = await submitPlace(
    test.db,
    ana,
    {
      name: 'Taverna do Dado',
      kind: 'game_cafe',
      postalCode: '51020-000',
      street: 'Av. Boa Viagem, 100',
      complement: '',
      description: '',
      openingHours: '',
      amenities: [],
      siteUrl: '',
      linkNetwork: [],
      linkUrl: [],
      removeImage: false,
    },
    { now, request: viacep },
  );
  await approvePlace(test.db, admin, placeId, { now });
  return { placeId, slug };
};
const placeAt = async (placeId: string) =>
  (await test.db.select().from(places).where(eq(places.id, placeId)))[0];
const stored = async (eventId: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
  return { ...row, attempts: 0 } as unknown as StoredEvent;
};
const claimIdOf = async (claimantId: string) =>
  (await test.db.select().from(placeClaims).where(eq(placeClaims.claimantId, claimantId)))[0].id;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(3), username: 'carla' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
  await test.db
    .insert(postalCodes)
    .values([{ cep: '51020000', neighbourhood: 'Boa Viagem', city: 'Recife', state: 'PE' }])
    .onConflictDoNothing();
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(places);
  await test.db.delete(events);
});

describe('claiming a place', () => {
  it('waits for an admin, once per member, and only on a listed place nobody owns', async () => {
    const { placeId, slug } = await listed();
    await fileClaim(test.db, bruno, slug, claim, { now });
    expect(await pendingClaimOf(test.db, placeId, bruno.id)).not.toBeNull();
    expect(await pendingClaimCount(test.db)).toBe(1);
    await expect(fileClaim(test.db, bruno, slug, claim, { now })).rejects.toMatchObject({
      message: 'claim_pending',
    });
    // Someone else may ask too: the admin picks one.
    await fileClaim(test.db, carla, slug, claim, { now });
    await expect(fileClaim(test.db, bruno, 'nowhere', claim, { now })).rejects.toThrow(NotFound);
    await expect(fileClaim(test.db, null, slug, claim, { now })).rejects.toThrow(Forbidden);
  });

  it('approving makes the claimant the owner, turns the others down and tells both', async () => {
    const { placeId, slug } = await listed();
    await fileClaim(test.db, bruno, slug, claim, { now });
    await fileClaim(test.db, carla, slug, { ...claim, relation: 'staff' }, { now });
    await expect(approveClaim(test.db, bruno, await claimIdOf(bruno.id))).rejects.toThrow(
      Forbidden,
    );

    const eventIds = await approveClaim(test.db, admin, await claimIdOf(bruno.id), { now });
    expect(await placeAt(placeId)).toMatchObject({ ownerId: bruno.id });
    expect(await pendingClaimCount(test.db)).toBe(0);
    for (const eventId of eventIds) await placeAlertHandler.handle(await stored(eventId), test.db);
    const bell = await test.db.select().from(notifications);
    expect(
      bell
        .map(({ recipientId, link, metadata }) => ({ recipientId, link, metadata }))
        .sort((a, b) => a.recipientId.localeCompare(b.recipientId)),
    ).toEqual([
      {
        recipientId: bruno.id,
        link: `/pp/${slug}`,
        metadata: { placeId, placeClaimApproved: 'Taverna do Dado' },
      },
      {
        recipientId: carla.id,
        link: null,
        metadata: { placeId, placeClaimRejected: 'Taverna do Dado' },
      },
    ]);
    await expect(fileClaim(test.db, ana, slug, claim, { now })).rejects.toMatchObject({
      message: 'place_already_owned',
    });
    await expect(approveClaim(test.db, admin, await claimIdOf(carla.id))).rejects.toMatchObject({
      message: 'closed',
    });
  });

  it('rejecting tells the claimant with the note, and they may ask again', async () => {
    const { placeId, slug } = await listed();
    await fileClaim(test.db, bruno, slug, claim, { now });
    const [eventId] = await rejectClaim(
      test.db,
      admin,
      await claimIdOf(bruno.id),
      { note: 'Não achamos o contato' },
      { now },
    );
    await placeAlertHandler.handle(await stored(eventId), test.db);
    const [notice] = await test.db.select().from(notifications);
    expect(notice.metadata).toEqual({
      placeId,
      placeClaimRejected: 'Taverna do Dado',
      note: 'Não achamos o contato',
    });
    await fileClaim(test.db, bruno, slug, claim, { now });
    expect(await pendingClaimOf(test.db, placeId, bruno.id)).not.toBeNull();
  });

  it('lists what waits for an admin, oldest first', async () => {
    const { slug } = await listed();
    await fileClaim(test.db, bruno, slug, claim, { now });
    await fileClaim(test.db, carla, slug, claim, { now: new Date(now.getTime() + 1000) });
    await expect(listClaims(test.db, bruno, new URLSearchParams())).rejects.toThrow(Forbidden);
    const list = (await listClaims(test.db, admin, new URLSearchParams()))!;
    expect(list.rows.map((row) => row.claimant.username)).toEqual(['bruno', 'carla']);
    expect(list.rows[0]).toMatchObject({
      relation: 'owner',
      contact: 'loja@taverna.test',
      place: { slug, owned: false },
    });
    expect(await listClaims(test.db, admin, new URLSearchParams('page=2'))).toBeNull();
  });
});

describe('giving a place back', () => {
  const owned = async () => {
    const listedPlace = await listed();
    await fileClaim(test.db, bruno, listedPlace.slug, claim, { now });
    await approveClaim(test.db, admin, await claimIdOf(bruno.id), { now });
    return listedPlace;
  };

  it('the owner hands it back, and nobody is told', async () => {
    const { placeId } = await owned();
    await expect(removePlaceOwner(test.db, carla, placeId)).rejects.toThrow(Forbidden);
    const [eventId] = await removePlaceOwner(test.db, bruno, placeId, { now });
    expect(await placeAt(placeId)).toMatchObject({ ownerId: null, ownerSince: null });
    await test.db.delete(notifications);
    await placeAlertHandler.handle(await stored(eventId), test.db);
    expect(await test.db.select().from(notifications)).toEqual([]);
    await expect(removePlaceOwner(test.db, bruno, placeId)).rejects.toThrow(Forbidden);
    await expect(removePlaceOwner(test.db, admin, placeId)).rejects.toMatchObject({
      message: 'not_owned',
    });
  });

  it('an admin takes the owner off, and the owner is told', async () => {
    const { placeId, slug } = await owned();
    const [eventId] = await removePlaceOwner(test.db, admin, placeId, { now });
    await test.db.delete(notifications);
    await placeAlertHandler.handle(await stored(eventId), test.db);
    const [notice] = await test.db.select().from(notifications);
    expect(notice).toMatchObject({
      recipientId: bruno.id,
      link: `/pp/${slug}`,
      metadata: { placeId, placeOwnerRemoved: 'Taverna do Dado' },
    });
  });
});
