import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PartnerInput } from '@mesaaberta/core/partners/schema';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  partners,
  profiles,
  reports,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb, pgErrorCode } from '../db/test-db';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import {
  approvePartner,
  listAdminPartners,
  removePartner,
  setPartnerTypes,
} from '@mesaaberta/core/server/partners/admin';
import {
  addPartner,
  filePartnerReport,
  findOwnPartner,
  listPartners,
  readPartnerPage,
  updatePartner,
  withdrawPartner,
} from '@mesaaberta/core/server/partners/service';

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

describe("a partner's page", () => {
  it('opens once approved, for anyone, with what its card shows', async () => {
    const { id: partnerId } = await send({
      couponCode: 'MESA10',
      linkNetwork: ['instagram'],
      linkUrl: ['@taverna'],
    });
    expect(await readPartnerPage(test.db, partnerId)).toBeNull();
    expect(await readPartnerPage(test.db, partnerId, { viewerId: id(2) })).toBeNull();
    // Its submitter sees it while it waits, marked.
    expect(await readPartnerPage(test.db, partnerId, { viewerId: id(1) })).toMatchObject({
      name: 'Taverna do Dado',
      pending: true,
    });
    await approvePartner(test.db, admin, partnerId, { now });
    const page = await readPartnerPage(test.db, partnerId);
    expect(page).toMatchObject({
      id: partnerId,
      name: 'Taverna do Dado',
      couponCode: 'MESA10',
      pending: false,
      ownerIds: [id(1)],
    });
    expect(page?.links).toEqual([{ network: 'instagram', url: 'https://instagram.com/taverna' }]);
  });

  it('is not found once withdrawn, or for an id that is not one', async () => {
    const { id: partnerId } = await send();
    await approvePartner(test.db, admin, partnerId, { now });
    await withdrawPartner(test.db, ana, partnerId);
    expect(await readPartnerPage(test.db, partnerId, { viewerId: id(1) })).toBeNull();
    expect(await readPartnerPage(test.db, 'nao-existe')).toBeNull();
  });
});

describe('kinds', () => {
  const listed = async (query: string) =>
    (await listPartners(test.db, filters(query), { viewerId: null }))!.cards.map(
      (card) => card.name,
    );
  const approved = async (name: string, types: string[]) => {
    const { id: partnerId } = await send({ name, types });
    await approvePartner(test.db, admin, partnerId);
    return partnerId;
  };

  it('are stored once each, in the list order, whatever order they were picked in', async () => {
    const { id: partnerId } = await send({ types: ['podcast', 'publisher', 'podcast'] });
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row.types).toEqual(['publisher', 'podcast']);
  });

  it('filter the page: a partner shows under each kind it picked', async () => {
    await approved('Dragão de Papel', ['publisher', 'podcast']);
    await approved('Covil do Goblin', ['shop']);
    expect(await listed('type=podcast')).toEqual(['Dragão de Papel']);
    expect(await listed('type=publisher')).toEqual(['Dragão de Papel']);
    expect(await listed('type=shop')).toEqual(['Covil do Goblin']);
    // An unknown kind in the address is dropped, not refused: the whole list shows.
    expect((await listed('type=hax')).sort()).toEqual(['Covil do Goblin', 'Dragão de Papel']);
  });

  it('are refused by the database past three or outside the list', async () => {
    const { id: partnerId } = await send();
    expect(
      await pgErrorCode(
        test.db
          .update(partners)
          .set({ types: ['shop', 'podcast', 'event', 'art'] })
          .where(eq(partners.id, partnerId)),
      ),
    ).toBe('23514');
    expect(
      await pgErrorCode(
        test.db
          .update(partners)
          .set({ types: ['casino'] })
          .where(eq(partners.id, partnerId)),
      ),
    ).toBe('23514');
  });

  it('go into the audit event when the submitter changes them', async () => {
    const { id: partnerId } = await send();
    await updatePartner(test.db, ana, partnerId, input({ types: ['shop', 'venue'] }), { now });
    const [event] = (await test.db.select().from(events)).filter(
      (row) => row.type === 'PartnerUpdated',
    );
    expect(JSON.stringify(event.payload)).toContain('shop,venue');
  });

  it('are corrected by an admin without taking the partner off the page', async () => {
    const partnerId = await approved('Covil do Goblin', ['shop']);
    await setPartnerTypes(test.db, admin, partnerId, ['venue', 'shop'], { now });
    expect(await listed('type=venue')).toEqual(['Covil do Goblin']);
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row.types).toEqual(['shop', 'venue']);
    expect(row.approvedAt).not.toBeNull();
  });

  it('are corrected by admins only, and never on a partner that was taken down', async () => {
    const partnerId = await approved('Covil do Goblin', ['shop']);
    await expect(setPartnerTypes(test.db, ana, partnerId, ['venue'])).rejects.toBeInstanceOf(
      Forbidden,
    );
    await withdrawPartner(test.db, ana, partnerId, { now });
    await expect(setPartnerTypes(test.db, admin, partnerId, ['venue'])).rejects.toBeInstanceOf(
      Invalid,
    );
  });

  it('filter the admin list, which also finds the partners without a kind', async () => {
    await approved('Covil do Goblin', ['shop']);
    const untyped = await approved('Guilda Antiga', ['community']);
    await test.db.update(partners).set({ types: [] }).where(eq(partners.id, untyped));
    const rows = async (query: string) =>
      (await listAdminPartners(
        test.db,
        admin,
        new URLSearchParams(`status=all&${query}`),
      ))!.rows.map((row) => row.name);
    expect(await rows('type=shop')).toEqual(['Covil do Goblin']);
    expect(await rows('type=none')).toEqual(['Guilda Antiga']);
  });
});

describe('the contact email', () => {
  it('is kept for admins and never part of the public list', async () => {
    const { id: partnerId } = await send({ contactEmail: 'dono@privado.example' });
    await approvePartner(test.db, admin, partnerId);
    const [card] = (await listPartners(test.db, filters(), { viewerId: id(2) }))!.cards;
    expect(JSON.stringify(card)).not.toContain('privado.example');
    const list = await listAdminPartners(test.db, admin, new URLSearchParams('status=all'));
    expect(list!.rows[0].contactEmail).toBe('dono@privado.example');
  });

  it('is optional', async () => {
    const { id: partnerId } = await send();
    const [row] = await test.db.select().from(partners).where(eq(partners.id, partnerId));
    expect(row.contactEmail).toBeNull();
  });

  it('is not written in the audit event when it changes', async () => {
    const { id: partnerId } = await send({ contactEmail: 'velho@privado.example' });
    await updatePartner(test.db, ana, partnerId, input({ contactEmail: 'novo@privado.example' }), {
      now,
    });
    const logged = JSON.stringify(await test.db.select().from(events));
    expect(logged).not.toContain('privado.example');
    expect(logged).toContain('contactEmail');
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
