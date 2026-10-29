import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  placeClaims,
  placeHostInvitations,
  placeHosts,
  places,
  postalCodes,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden } from '@mesaaberta/core/server/errors';
import { approvePlace } from '@mesaaberta/core/server/places/admin';
import { approveClaim, fileClaim } from '@mesaaberta/core/server/places/claims';
import {
  cancelPlaceHostInvitation,
  hostedPlacesOf,
  invitePlaceHost,
  listPlaceHosts,
  removePlaceHost,
  respondToPlaceHostInvitation,
} from '@mesaaberta/core/server/places/hosts';
import { placeGms } from '@mesaaberta/core/server/places/people';
import { listGmDirectory } from '@mesaaberta/core/server/gms/directory';
import { readGmDirectoryFilters } from '@mesaaberta/core/gms/directory-filters';
import { directoryLinkHandler } from '@mesaaberta/core/server/events/directory-links';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { submitPlace } from '@mesaaberta/core/server/places/service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-29T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);
const caio = member(3);
const viacep = vi.fn<typeof fetch>(async () => Response.json({ erro: true }));

/** A listed place Caio sent and Ana owns: an admin approved her claim. */
const ownedPlace = async () => {
  const { id: placeId, slug } = await submitPlace(
    test.db,
    caio,
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

/** Runs the bell handler over each event, as the sweeper would, and returns what it wrote. */
const deliver = async (eventIds: string[]) => {
  for (const eventId of eventIds) {
    const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
    await directoryLinkHandler.handle({ ...row, attempts: 0 } as unknown as StoredEvent, test.db);
  }
  return test.db
    .select({
      recipientId: notifications.recipientId,
      type: notifications.type,
      link: notifications.link,
      metadata: notifications.metadata,
    })
    .from(notifications);
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana', tableRole: 'gm' },
    // Bruno never said he mestra: a place's people are listed whatever their profile says.
    { id: id(2), username: 'bruno', tableRole: 'player' },
    { id: id(3), username: 'caio', tableRole: 'player' },
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
  await test.db.delete(placeHostInvitations);
  await test.db.delete(placeHosts);
  await test.db.delete(places);
  await test.db.delete(events);
});

describe('house GMs', () => {
  it('are invited by the owner or an admin, and show only once they accept', async () => {
    const { placeId, slug } = await ownedPlace();
    await expect(invitePlaceHost(test.db, caio, placeId, 'bruno', { now })).rejects.toThrow(
      Forbidden,
    );

    const invited = await invitePlaceHost(test.db, ana, placeId, '@Bruno', { now });
    expect(await deliver(invited.eventIds)).toEqual([
      {
        recipientId: bruno.id,
        type: 'place_host_invited',
        link: `/pp/${slug}/house/${invited.invitationId}`,
        metadata: { placeId, place: 'Taverna do Dado' },
      },
    ]);
    // One invite at a time, and not shown until accepted.
    await expect(invitePlaceHost(test.db, ana, placeId, 'bruno', { now })).rejects.toThrow(
      'unavailable',
    );
    expect((await placeGms(test.db, placeId, now)).total).toBe(0);
    expect((await listPlaceHosts(test.db, ana, slug)).invitations).toHaveLength(1);

    await test.db.delete(notifications);
    const answer = await respondToPlaceHostInvitation(
      test.db,
      bruno,
      invited.invitationId!,
      'accept',
      { now },
    );
    expect(answer.status).toBe('accepted');
    expect(await deliver(answer.eventIds)).toMatchObject([
      { recipientId: ana.id, type: 'place_host_invitation_accepted', link: `/pp/${slug}/edit` },
    ]);

    expect(await placeGms(test.db, placeId, now)).toEqual({
      total: 1,
      people: [expect.objectContaining({ username: 'bruno', house: true, tables: 0 })],
    });
    expect((await hostedPlacesOf(test.db, [bruno.id])).get(bruno.id)).toEqual([
      { id: placeId, slug, name: 'Taverna do Dado' },
    ]);
    // /gamemasters?place= lists him, though his profile says he only plays.
    const listed = await listGmDirectory(
      test.db,
      readGmDirectoryFilters(new URLSearchParams(`place=${slug}`)),
      now,
    );
    expect(listed!.place).toEqual({ slug, name: 'Taverna do Dado' });
    expect(listed!.people.map((gm) => [gm.username, gm.hostedAt])).toEqual([
      ['bruno', [{ slug, name: 'Taverna do Dado' }]],
    ]);
  });

  it('take the owner at once when they name themself, with nobody told', async () => {
    const { placeId } = await ownedPlace();
    expect(await invitePlaceHost(test.db, ana, placeId, 'ana', { now })).toEqual({
      invitationId: null,
      eventIds: [],
    });
    expect((await placeGms(test.db, placeId, now)).people.map((gm) => gm.username)).toEqual([
      'ana',
    ]);
  });

  it('can leave, which tells the owner, or be taken off, which tells them', async () => {
    const { placeId, slug } = await ownedPlace();
    const invited = await invitePlaceHost(test.db, ana, placeId, 'bruno', { now });
    await respondToPlaceHostInvitation(test.db, bruno, invited.invitationId!, 'accept', { now });
    await test.db.delete(notifications);

    // Caio is neither the person nor the owner.
    await expect(removePlaceHost(test.db, caio, placeId, bruno.id, { now })).rejects.toThrow(
      Forbidden,
    );
    const left = await removePlaceHost(test.db, bruno, placeId, bruno.id, { now });
    expect(await deliver(left.eventIds)).toEqual([
      {
        recipientId: ana.id,
        type: 'place_host_removed',
        link: `/pp/${slug}/edit`,
        metadata: { placeId, place: 'Taverna do Dado', left: '1' },
      },
    ]);

    await test.db.delete(notifications);
    await test.db.delete(placeHostInvitations);
    const again = await invitePlaceHost(test.db, ana, placeId, 'bruno', { now });
    await respondToPlaceHostInvitation(test.db, bruno, again.invitationId!, 'accept', { now });
    await test.db.delete(notifications);
    const removed = await removePlaceHost(test.db, ana, placeId, bruno.id, { now });
    expect(await deliver(removed.eventIds)).toEqual([
      {
        recipientId: bruno.id,
        type: 'place_host_removed',
        link: null,
        metadata: { placeId, place: 'Taverna do Dado' },
      },
    ]);
    expect((await placeGms(test.db, placeId, now)).total).toBe(0);
  });

  it('tell nobody of an invite withdrawn before the bell ran', async () => {
    const { placeId } = await ownedPlace();
    const invited = await invitePlaceHost(test.db, ana, placeId, 'bruno', { now });
    const cancelled = await cancelPlaceHostInvitation(test.db, ana, invited.invitationId!, {
      now,
    });
    expect(await deliver([...invited.eventIds, ...cancelled.eventIds])).toEqual([]);
  });
});
