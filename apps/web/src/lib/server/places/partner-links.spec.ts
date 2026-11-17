import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  partners,
  partnerShownGms,
  placePartnerLinks,
  placeClaims,
  places,
  postalCodes,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden } from '@mesaaberta/core/server/errors';
import { approvePlace } from '@mesaaberta/core/server/places/admin';
import { approveClaim, fileClaim } from '@mesaaberta/core/server/places/claims';
import { listPlaces, readPlacePage } from '@mesaaberta/core/server/places/directory';
import {
  approvePartnerLink,
  endPlacePartner,
  listPartnerLinks,
  partnerOfPlace,
  partnerReachOf,
  pendingPartnerLinkCount,
  placePartnerState,
  rejectPartnerLink,
  requestPlacePartner,
  setShownAsGm,
  shownGmsOf,
} from '@mesaaberta/core/server/places/partner-links';
import { partnerConnections } from '@mesaaberta/core/server/directories/links';
import { directoryLinkHandler } from '@mesaaberta/core/server/events/directory-links';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { submitPlace } from '@mesaaberta/core/server/places/service';
import { readPlaceFilters } from '@mesaaberta/core/places/filters';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-29T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);
const viacep = vi.fn<typeof fetch>(async () => Response.json({ erro: true }));
const taverna = id(50);
const goblin = id(51);

/** A listed place Bruno sent and Ana owns: an admin approved her claim. */
const ownedPlace = async () => {
  const { id: placeId, slug } = await submitPlace(
    test.db,
    bruno,
    {
      name: 'Taverna do Dado',
      kind: 'game_cafe',
      postalCode: '51020-000',
      street: 'Av. Boa Viagem, 100',
      complement: '',
      description: '',
      openingHours: '',
      tags: [],
      amenities: [],
      siteUrl: '',
      linkNetwork: [],
      linkUrl: [],
      removeImage: false,
    },
    { now, request: viacep },
  );
  await approvePlace(test.db, admin, placeId, { now });
  await fileClaim(
    test.db,
    ana,
    slug,
    { relation: 'owner', contact: 'ana@taverna.test', note: '', confirm: true },
    { now },
  );
  const [{ claimId }] = await test.db
    .select({ claimId: placeClaims.id })
    .from(placeClaims)
    .where(eq(placeClaims.placeId, placeId));
  await approveClaim(test.db, admin, claimId, { now });
  return { placeId, slug };
};
const stored = async (eventId: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
  return { ...row, attempts: 0 } as unknown as StoredEvent;
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana', tableRole: 'gm' },
    { id: id(2), username: 'bruno', tableRole: 'player' },
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
  await test.db.delete(placePartnerLinks);
  await test.db.delete(places);
  await test.db.delete(partnerShownGms);
  await test.db.delete(partners);
  await test.db.delete(events);
  // Ana looks after Taverna do Dado Editora; Bruno after Goblin Games.
  await test.db.insert(partners).values([
    {
      id: taverna,
      name: 'Taverna do Dado Editora',
      logoPath: 'partners/t/logo.png',
      submitterId: ana.id,
      approvedAt: now,
    },
    {
      id: goblin,
      name: 'Goblin Games',
      logoPath: 'partners/g/logo.png',
      submitterId: bruno.id,
      approvedAt: now,
    },
  ] as never);
});

describe('asking to show a place as a partner', () => {
  it('is for someone who owns the place and looks after the partner, or an admin', async () => {
    const { slug } = await ownedPlace();
    // Bruno sent the place but does not own it; Ana does not look after Goblin.
    await expect(requestPlacePartner(test.db, bruno, slug, goblin, { now })).rejects.toThrow(
      Forbidden,
    );
    await expect(requestPlacePartner(test.db, ana, slug, goblin, { now })).rejects.toThrow(
      Forbidden,
    );
    await expect(requestPlacePartner(test.db, ana, slug, id(77), { now })).rejects.toMatchObject({
      message: 'unavailable',
    });
    expect(await requestPlacePartner(test.db, ana, slug, taverna, { now })).toHaveLength(1);
    expect(await pendingPartnerLinkCount(test.db)).toBe(1);
    // Asking again replaces the request that waits.
    await requestPlacePartner(test.db, admin, slug, goblin, { now });
    expect(await pendingPartnerLinkCount(test.db)).toBe(1);
  });

  it('shows the edit section to the owner and admins only, with what they could pick', async () => {
    const { slug } = await ownedPlace();
    expect(await placePartnerState(test.db, bruno, slug)).toBeNull();
    await requestPlacePartner(test.db, ana, slug, taverna, { now });
    const state = await placePartnerState(test.db, ana, slug);
    expect(state).toMatchObject({
      approved: null,
      pending: { partnerId: taverna, name: 'Taverna do Dado Editora' },
      options: [{ id: taverna, name: 'Taverna do Dado Editora' }],
    });
    expect(await placePartnerState(test.db, admin, slug)).toMatchObject({ options: [] });
  });
});

describe('an admin deciding', () => {
  it('approving shows the partner on the place and the place on the partner', async () => {
    const { placeId, slug } = await ownedPlace();
    await requestPlacePartner(test.db, ana, slug, taverna, { now });
    const list = await listPartnerLinks(test.db, admin, new URLSearchParams());
    expect(list?.rows).toMatchObject([
      {
        status: 'pending',
        place: { slug, name: 'Taverna do Dado' },
        partner: { id: taverna },
        requester: { username: 'ana' },
      },
    ]);
    await expect(approvePartnerLink(test.db, ana, list!.rows[0].id)).rejects.toThrow(Forbidden);
    const [eventId] = await approvePartnerLink(test.db, admin, list!.rows[0].id, { now });

    expect(await partnerOfPlace(test.db, placeId)).toEqual({
      id: taverna,
      name: 'Taverna do Dado Editora',
    });
    expect((await readPlacePage(test.db, slug, null, now))?.partner).toMatchObject({
      id: taverna,
    });
    const { places: partnerPlaces } = await partnerConnections(test.db, taverna, now);
    expect(partnerPlaces).toMatchObject([{ slug, partner: true }]);
    const onlyPartners = await listPlaces(
      test.db,
      readPlaceFilters(new URLSearchParams('partner=1')),
      now,
    );
    expect(onlyPartners?.places.map((place) => place.slug)).toEqual([slug]);
    expect((await partnerReachOf(test.db, [taverna])).get(taverna)).toMatchObject({ places: 1 });

    // The admin approved Ana's request: she hears of it.
    await directoryLinkHandler.handle(await stored(eventId), test.db);
    const told = await test.db.select().from(notifications);
    expect(told).toMatchObject([
      {
        recipientId: ana.id,
        type: 'moderation_notice',
        link: `/pp/${slug}`,
        metadata: { placePartnerApproved: 'Taverna do Dado', partner: 'Taverna do Dado Editora' },
      },
    ]);
  });

  it('rejecting keeps the place as it was and tells the requester why', async () => {
    const { placeId, slug } = await ownedPlace();
    await requestPlacePartner(test.db, ana, slug, taverna, { now });
    const [link] = await test.db.select().from(placePartnerLinks);
    const [eventId] = await rejectPartnerLink(
      test.db,
      admin,
      link.id,
      { note: 'Sem site' },
      { now },
    );
    await expect(approvePartnerLink(test.db, admin, link.id)).rejects.toMatchObject({
      message: 'closed',
    });
    expect(await partnerOfPlace(test.db, placeId)).toBeNull();
    await directoryLinkHandler.handle(await stored(eventId), test.db);
    expect(await test.db.select().from(notifications)).toMatchObject([
      {
        recipientId: ana.id,
        link: null,
        metadata: { placePartnerRejected: 'Taverna do Dado', note: 'Sem site' },
      },
    ]);
  });
});

describe('taking a link back', () => {
  it('withdraws a request quietly and takes a link down with an event', async () => {
    const { placeId, slug } = await ownedPlace();
    await requestPlacePartner(test.db, ana, slug, taverna, { now });
    expect(await endPlacePartner(test.db, ana, slug, 'pending', { now })).toEqual([]);
    expect(await pendingPartnerLinkCount(test.db)).toBe(0);
    await expect(endPlacePartner(test.db, ana, slug, 'approved', { now })).rejects.toMatchObject({
      message: 'not_found',
    });

    await requestPlacePartner(test.db, ana, slug, taverna, { now });
    const [link] = await test.db
      .select()
      .from(placePartnerLinks)
      .where(eq(placePartnerLinks.status, 'pending'));
    await approvePartnerLink(test.db, admin, link.id, { now });
    await expect(endPlacePartner(test.db, bruno, slug, 'approved', { now })).rejects.toThrow(
      Forbidden,
    );
    // An admin takes it down: Ana, who asked, is told.
    const [eventId] = await endPlacePartner(test.db, admin, slug, 'approved', { now });
    expect(await partnerOfPlace(test.db, placeId)).toBeNull();
    await directoryLinkHandler.handle(await stored(eventId), test.db);
    expect(await test.db.select().from(notifications)).toMatchObject([
      { recipientId: ana.id, metadata: { placePartnerRemoved: 'Taverna do Dado' } },
    ]);
  });
});

describe('showing who looks after a partner under Quem mestra', () => {
  it('is each owner’s own choice, and only for one whose profile says they run games', async () => {
    await expect(setShownAsGm(test.db, bruno, taverna, true)).rejects.toThrow(Forbidden);
    await setShownAsGm(test.db, ana, taverna, true);
    await setShownAsGm(test.db, bruno, goblin, true);
    expect(await shownGmsOf(test.db, [taverna, goblin])).toEqual([
      {
        partnerId: taverna,
        username: 'ana',
        name: null,
        avatarPath: null,
        avatarUrl: null,
      },
    ]);
    expect((await partnerReachOf(test.db, [taverna])).get(taverna)).toEqual({
      places: 0,
      gms: ['ana'],
    });
    await setShownAsGm(test.db, ana, taverna, false);
    expect(await shownGmsOf(test.db, [taverna])).toEqual([]);
  });
});
