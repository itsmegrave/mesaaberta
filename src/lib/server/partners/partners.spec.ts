import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PartnerInput } from '$lib/partners/schema';
import { readPartnerFilters } from '$lib/partners/filters';
import type { Actor } from '../auth/policy';
import { events, notifications, partners, profiles, reports } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, Invalid, NotFound } from '../errors';
import { approvePartner, listAdminPartners, removePartner } from './admin';
import {
  addPartner,
  filePartnerReport,
  findOwnPartner,
  listPartners,
  updatePartner,
  withdrawPartner,
} from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-10T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);

const input = (over: Partial<PartnerInput> = {}): PartnerInput => ({
  name: 'Taverna do Dado',
  description: 'Loja de jogos',
  siteUrl: 'https://taverna.example',
  backlinkUrl: '',
  couponCode: '',
  couponDescription: '',
  linkNetwork: [],
  linkUrl: [],
  ...over,
});
const filters = (query = '') => readPartnerFilters(new URLSearchParams(query));
const send = (over: Partial<PartnerInput> = {}, actor: Actor = ana) =>
  addPartner(test.db, actor, input(over), { logoPath: `partners/${actor.id}/a.png`, now });
const names = async (viewerId: string | null = null) =>
  (await listPartners(test.db, filters(), { viewerId }))!.cards.map((card) => card.name);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
  await test.db.delete(reports);
  await test.db.delete(partners);
  await test.db.delete(events);
});

describe('a new partner', () => {
  it('waits for an admin: nobody but its submitter sees it', async () => {
    await send();
    expect(await names()).toEqual([]);
    expect(await names(id(2))).toEqual([]);
    expect(await names(id(1))).toEqual(['Taverna do Dado']);
  });

  it('is public once an admin approves it, and the submitter is told', async () => {
    const { id: partnerId } = await send();
    const [eventId] = await approvePartner(test.db, admin, partnerId, { now });
    expect(eventId).toBeTruthy();
    expect(await names()).toEqual(['Taverna do Dado']);
  });

  it('is approved by admins only', async () => {
    const { id: partnerId } = await send();
    await expect(approvePartner(test.db, ana, partnerId)).rejects.toBeInstanceOf(Forbidden);
  });

  it('cannot be approved twice', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId);
    await expect(approvePartner(test.db, admin, partnerId)).rejects.toBeInstanceOf(Invalid);
  });

  it('lists a card with its coupon', async () => {
    const { id: partnerId } = await send({ couponCode: 'MESA10', couponDescription: '10% off' });
    await approvePartner(test.db, admin, partnerId);
    const [card] = (await listPartners(test.db, filters(), { viewerId: id(2) }))!.cards;
    expect(card).toMatchObject({ couponCode: 'MESA10', couponDescription: '10% off' });
  });

  it('keeps a coupon description only with a code', async () => {
    const { id: partnerId } = await send({ couponDescription: 'orphan' });
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row.couponCode).toBeNull();
    expect(row.couponDescription).toBeNull();
  });
});

describe('editing and withdrawing', () => {
  it('sends an approved partner back to review', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId);
    await updatePartner(test.db, ana, partnerId, input({ name: 'Taverna Nova' }), { now });
    expect(await names()).toEqual([]);
    expect(await names(id(1))).toEqual(['Taverna Nova']);
  });

  it('replaces the logo and says which file to delete', async () => {
    const { id: partnerId } = await send();
    const result = await updatePartner(test.db, ana, partnerId, input(), {
      logoPath: `partners/${id(1)}/b.png`,
      now,
    });
    expect(result.replacedLogo).toBe(`partners/${id(1)}/a.png`);
  });

  it('opens for its submitter only', async () => {
    const { id: partnerId } = await send();
    expect(await findOwnPartner(test.db, ana, partnerId)).toMatchObject({
      name: 'Taverna do Dado',
    });
    await expect(findOwnPartner(test.db, bruno, partnerId)).rejects.toBeInstanceOf(Error);
    await expect(updatePartner(test.db, bruno, partnerId, input())).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it('is taken off by its submitter, and the admin list says so', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId);
    await withdrawPartner(test.db, ana, partnerId, { now });
    expect(await names()).toEqual([]);
    await expect(withdrawPartner(test.db, ana, partnerId)).rejects.toBeInstanceOf(NotFound);
    const list = await listAdminPartners(test.db, admin, new URLSearchParams('status=removed'));
    expect(list!.rows).toHaveLength(1);
  });
});

describe('reports and removal', () => {
  it('lets a member report a partner on the page, but not their own', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId);
    await filePartnerReport(
      test.db,
      bruno,
      partnerId,
      { reason: 'no_backlink', details: '' },
      { now },
    );
    await expect(
      filePartnerReport(test.db, ana, partnerId, { reason: 'spam', details: '' }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('cannot report one that is not on the page', async () => {
    const { id: partnerId } = await send();
    await expect(
      filePartnerReport(test.db, bruno, partnerId, { reason: 'spam', details: '' }),
    ).rejects.toBeInstanceOf(NotFound);
  });

  it('is removed with a reason: it leaves the page, open reports are accepted, an event is recorded', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId);
    await filePartnerReport(
      test.db,
      bruno,
      partnerId,
      { reason: 'no_backlink', details: '' },
      { now },
    );
    const eventIds = await removePartner(
      test.db,
      admin,
      partnerId,
      { reason: 'no_backlink', note: 'Sem link' },
      { now },
    );
    expect(eventIds.length).toBeGreaterThan(0);
    expect(await names()).toEqual([]);
    const [report] = await test.db.select().from(reports);
    expect(report.status).toBe('resolved');
    await expect(
      removePartner(test.db, admin, partnerId, { reason: 'spam', note: '' }),
    ).rejects.toBeInstanceOf(Invalid);
  });
});
