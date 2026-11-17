import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { PartnerInput } from '@mesaaberta/core/partners/schema';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  partnerInvitations,
  partnerOwners,
  partners,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { moderationHandler } from '@mesaaberta/core/server/events/moderation';
import {
  partnerInvitationMail,
  partnerOwnerNotificationHandler,
} from '@mesaaberta/core/server/events/partner-owners';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { approvePartner } from '@mesaaberta/core/server/partners/admin';
import {
  cancelPartnerInvitation,
  invitePartnerOwner,
  listPartnerOwners,
  loadPartnerInvitation,
  removePartnerOwner,
  respondToPartnerInvitation,
} from '@mesaaberta/core/server/partners/owners';
import {
  addPartner,
  filePartnerReport,
  findOwnPartner,
  listPartners,
  updatePartner,
  withdrawPartner,
} from '@mesaaberta/core/server/partners/service';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
// Recent: the bell checks an invite still waits against the clock.
const now = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
const later = (days: number) => new Date(now.getTime() + days * 86_400_000);
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const [ana, bruno, caio] = [1, 2, 3].map(member);

const input = (over: Partial<PartnerInput> = {}): PartnerInput => ({
  name: 'Taverna do Dado',
  description: 'Loja de jogos',
  types: ['shop'],
  contactEmail: '',
  siteUrl: 'https://taverna.example',
  backlinkUrl: '',
  couponCode: '',
  couponDescription: '',
  linkNetwork: [],
  linkUrl: [],
  ...over,
});
const send = async () =>
  (await addPartner(test.db, ana, input(), { logoPath: `partners/${ana.id}/a.png`, now })).id;
const invite = (partnerId: string, username: string, by: Actor = ana, at = now) =>
  invitePartnerOwner(test.db, by, partnerId, username, { now: at });
const accept = (invitationId: string, by: Actor, at = now) =>
  respondToPartnerInvitation(test.db, by, invitationId, 'accept', { now: at });
const ownerNames = async (partnerId: string, actor: Actor = ana) =>
  (await listPartnerOwners(test.db, actor, partnerId, { now })).owners.map((o) => o.username);
const stored = async (eventId: string) => {
  const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
  return { ...row, attempts: 0 } as unknown as StoredEvent;
};
const bell = async (recipient: Actor) =>
  test.db
    .select({
      type: notifications.type,
      link: notifications.link,
      metadata: notifications.metadata,
    })
    .from(notifications)
    .where(eq(notifications.recipientId, recipient.id));

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(3), username: 'caio' },
    { id: id(4), username: 'dora' },
    { id: id(5), username: 'eva' },
    { id: id(6), username: 'fabi' },
    { id: id(7), username: 'gil', invitationsEnabled: false },
    { id: id(8), username: 'hugo', status: 'suspended' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(partners);
  await test.db.delete(events);
});

describe('who looks after a partner', () => {
  it('starts as the member who sent it', async () => {
    const partnerId = await send();
    const { owners, invitations } = await listPartnerOwners(test.db, ana, partnerId, { now });
    expect(owners).toMatchObject([{ profileId: ana.id, username: 'ana', submitter: true }]);
    expect(invitations).toEqual([]);
    await expect(listPartnerOwners(test.db, bruno, partnerId)).rejects.toBeInstanceOf(Forbidden);
  });

  it('grows only when the invited account accepts', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, '@Bruno');
    expect(await ownerNames(partnerId)).toEqual(['ana']);
    expect((await listPartnerOwners(test.db, ana, partnerId, { now })).invitations).toMatchObject([
      { id: invitationId, username: 'bruno' },
    ]);
    // Before accepting, Bruno is not an owner: no edit page, no pending card.
    await expect(findOwnPartner(test.db, bruno, partnerId)).rejects.toBeInstanceOf(Forbidden);
    let cards = (await listPartners(test.db, readPartnerFilters(new URLSearchParams()), {
      viewerId: bruno.id,
    }))!.cards;
    expect(cards).toEqual([]);

    expect(await accept(invitationId, bruno)).toMatchObject({ status: 'accepted' });
    expect(await ownerNames(partnerId)).toEqual(['ana', 'bruno']);
    expect(await findOwnPartner(test.db, bruno, partnerId)).toMatchObject({ id: partnerId });
    cards = (await listPartners(test.db, readPartnerFilters(new URLSearchParams()), {
      viewerId: bruno.id,
    }))!.cards;
    expect(cards).toMatchObject([{ id: partnerId, pending: true, ownerIds: [ana.id, bruno.id] }]);

    // Bruno edits it like Ana could: it goes back to review.
    await approvePartner(test.db, admin, partnerId, { now });
    await updatePartner(test.db, bruno, partnerId, input({ name: 'Taverna Nova' }), { now });
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row).toMatchObject({ name: 'Taverna Nova', approvedAt: null });
  });

  it('cannot be reported by any of its owners', async () => {
    const partnerId = await send();
    await accept((await invite(partnerId, 'bruno')).invitationId, bruno);
    await approvePartner(test.db, admin, partnerId, { now });
    const report = { reason: 'spam' as const, details: '' };
    await expect(filePartnerReport(test.db, bruno, partnerId, report)).rejects.toBeInstanceOf(
      Forbidden,
    );
    await expect(filePartnerReport(test.db, caio, partnerId, report)).resolves.toBeTruthy();
  });

  it('refuses every invite that cannot go through with the same answer', async () => {
    const partnerId = await send();
    await invite(partnerId, 'bruno');
    for (const name of ['ninguem', 'ana', 'bruno', 'gil', 'hugo'])
      await expect(invite(partnerId, name)).rejects.toMatchObject({
        field: 'username',
        message: 'unavailable',
      });
    // Only an owner invites.
    await expect(invite(partnerId, 'caio', caio)).rejects.toBeInstanceOf(Forbidden);
  });

  it('stops at five accounts, counting the invites that wait', async () => {
    const partnerId = await send();
    for (const name of ['bruno', 'caio', 'dora', 'eva']) await invite(partnerId, name);
    await expect(invite(partnerId, 'fabi')).rejects.toMatchObject({ message: 'too_many' });
    // A lapsed invite frees its place.
    await expect(invite(partnerId, 'fabi', ana, later(8))).resolves.toBeTruthy();
  });

  it('lets a declined invite be sent again only after a week', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, 'bruno');
    expect(
      await respondToPartnerInvitation(test.db, bruno, invitationId, 'decline', { now }),
    ).toMatchObject({ status: 'declined' });
    await expect(invite(partnerId, 'bruno', ana, later(3))).rejects.toBeInstanceOf(Invalid);
    await expect(invite(partnerId, 'bruno', ana, later(8))).resolves.toBeTruthy();
  });

  it('lapses after seven days', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, 'bruno');
    expect(await accept(invitationId, bruno, later(7))).toMatchObject({ status: 'expired' });
    expect(await ownerNames(partnerId)).toEqual(['ana']);
  });

  it('is shown and answered by the invited person only', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, 'bruno');
    expect(await loadPartnerInvitation(test.db, bruno, invitationId)).toMatchObject({
      status: 'pending',
      inviter: 'ana',
      partner: { id: partnerId, name: 'Taverna do Dado', removed: false },
    });
    await expect(loadPartnerInvitation(test.db, caio, invitationId)).rejects.toBeInstanceOf(
      NotFound,
    );
    await expect(accept(invitationId, caio)).rejects.toBeInstanceOf(NotFound);
    await expect(accept(invitationId, ana)).rejects.toBeInstanceOf(NotFound);
  });

  it('is cancelled by an owner, and a cancelled invite cannot be accepted', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, 'bruno');
    await expect(
      cancelPartnerInvitation(test.db, caio, invitationId, { now }),
    ).rejects.toBeInstanceOf(NotFound);
    expect(
      (await cancelPartnerInvitation(test.db, ana, invitationId, { now })).eventIds,
    ).toHaveLength(1);
    expect(await accept(invitationId, bruno)).toMatchObject({ status: 'cancelled' });
    expect(await ownerNames(partnerId)).toEqual(['ana']);
  });

  it('is cancelled when the partner left the page before the answer', async () => {
    const partnerId = await send();
    const { invitationId } = await invite(partnerId, 'bruno');
    await withdrawPartner(test.db, ana, partnerId, { now });
    expect(await accept(invitationId, bruno)).toMatchObject({ status: 'cancelled' });
  });

  it('loses an account another owner takes off, and keeps at least one', async () => {
    const partnerId = await send();
    await accept((await invite(partnerId, 'bruno')).invitationId, bruno);
    // Every owner is equal: Bruno may take Ana off, even though she sent it.
    await removePartnerOwner(test.db, bruno, partnerId, ana.id, { now });
    expect(await ownerNames(partnerId, bruno)).toEqual(['bruno']);
    await expect(findOwnPartner(test.db, ana, partnerId)).rejects.toBeInstanceOf(Forbidden);
    // The last one cannot leave: they withdraw the partner instead.
    await expect(
      removePartnerOwner(test.db, bruno, partnerId, bruno.id, { now }),
    ).rejects.toMatchObject({ message: 'last_owner' });
    await expect(removePartnerOwner(test.db, ana, partnerId, bruno.id)).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it('treats a partner with no owner row as its submitter’s, until someone is invited', async () => {
    const partnerId = await send();
    await test.db.delete(partnerOwners).where(eq(partnerOwners.partnerId, partnerId));
    expect(await findOwnPartner(test.db, ana, partnerId)).toMatchObject({ id: partnerId });
    await invite(partnerId, 'bruno');
    const rows = await test.db
      .select()
      .from(partnerOwners)
      .where(and(eq(partnerOwners.partnerId, partnerId), eq(partnerOwners.profileId, ana.id)));
    expect(rows).toHaveLength(1);
  });
});

describe('the bell for who looks after a partner', () => {
  it('tells the invited person, then whoever invited of the answer', async () => {
    const partnerId = await send();
    const { invitationId, eventIds } = await invite(partnerId, 'bruno');
    await partnerOwnerNotificationHandler.handle(await stored(eventIds[0]), test.db);
    expect(await bell(bruno)).toEqual([
      {
        type: 'partner_invited',
        link: `/p/invitations/${invitationId}`,
        metadata: { partnerId, partner: 'Taverna do Dado' },
      },
    ]);
    const answered = await accept(invitationId, bruno);
    await partnerOwnerNotificationHandler.handle(await stored(answered.eventIds[0]), test.db);
    expect(await bell(ana)).toMatchObject([
      { type: 'partner_invitation_accepted', link: `/p/${partnerId}/edit` },
    ]);
  });

  it('says nothing of an invite that no longer waits', async () => {
    const partnerId = await send();
    const { invitationId, eventIds } = await invite(partnerId, 'bruno');
    await cancelPartnerInvitation(test.db, ana, invitationId, { now });
    await partnerOwnerNotificationHandler.handle(await stored(eventIds[0]), test.db);
    expect(await bell(bruno)).toEqual([]);
  });

  it('tells an account it was taken off, but not one that left', async () => {
    const partnerId = await send();
    await accept((await invite(partnerId, 'bruno')).invitationId, bruno);
    await accept((await invite(partnerId, 'caio')).invitationId, caio);
    const removed = await removePartnerOwner(test.db, ana, partnerId, bruno.id, { now });
    await partnerOwnerNotificationHandler.handle(await stored(removed.eventIds[0]), test.db);
    expect(await bell(bruno)).toMatchObject([{ type: 'partner_owner_removed', link: null }]);
    const left = await removePartnerOwner(test.db, caio, partnerId, caio.id, { now });
    await partnerOwnerNotificationHandler.handle(await stored(left.eventIds[0]), test.db);
    expect(await bell(caio)).toEqual([]);
  });

  it('sends moderation news to every owner, and a withdrawal to the others', async () => {
    const partnerId = await send();
    await accept((await invite(partnerId, 'bruno')).invitationId, bruno);
    const [approved] = await approvePartner(test.db, admin, partnerId, { now });
    await moderationHandler.handle(await stored(approved), test.db);
    for (const owner of [ana, bruno])
      expect(await bell(owner)).toMatchObject([
        { type: 'moderation_notice', metadata: { partnerApproved: 'Taverna do Dado' } },
      ]);

    await test.db.delete(notifications);
    const withdrawn = await withdrawPartner(test.db, bruno, partnerId, { now });
    await moderationHandler.handle(await stored(withdrawn.at(-1)!), test.db);
    expect(await bell(ana)).toMatchObject([
      { type: 'moderation_notice', metadata: { partnerWithdrawn: 'Taverna do Dado' } },
    ]);
    expect(await bell(bruno)).toEqual([]);
  });

  it('words the invite e-mail with the partner, who invited and the link', () => {
    const mail = partnerInvitationMail({
      name: 'bruno',
      inviter: 'ana',
      partner: 'Taverna do Dado',
      expiresAt: later(7),
      url: 'https://mesaaberta.app/p/invitations/x',
    });
    expect(mail.subject).toBe('Convite para cuidar de Taverna do Dado');
    expect(mail.text).toContain('@ana convidou você para cuidar de “Taverna do Dado”');
    expect(mail.text).toContain('https://mesaaberta.app/p/invitations/x');
  });
});

it('keeps one pending invite per account and partner', async () => {
  const partnerId = await send();
  await invite(partnerId, 'bruno');
  const pending = await test.db
    .select()
    .from(partnerInvitations)
    .where(eq(partnerInvitations.partnerId, partnerId));
  expect(pending).toHaveLength(1);
});
