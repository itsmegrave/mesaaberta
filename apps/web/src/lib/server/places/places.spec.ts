import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PlaceInput } from '@mesaaberta/core/places/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  events,
  notifications,
  placeLinks,
  places,
  placeTags,
  postalCodes,
  profiles,
  reports,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import {
  approvePlace,
  listAdminPlaces,
  pendingPlaceCount,
  removePlace,
  restorePlace,
} from '@mesaaberta/core/server/places/admin';
import { placeAlertHandler } from '@mesaaberta/core/server/events/place-alerts';
import { moderationHandler } from '@mesaaberta/core/server/events/moderation';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import {
  filePlaceReport,
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
    // Members who report, in the auto-hide tests.
    ...[10, 11, 12, 13, 14, 15, 16].map((n) => ({ id: id(n), username: `membro${n}` })),
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
  await test.db.delete(notifications);
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

describe('the admin list', () => {
  const list = (query = '') => listAdminPlaces(test.db, admin, new URLSearchParams(query));

  it('opens on the places that wait, oldest first, naming who sent each', async () => {
    const first = await send();
    const second = await send({ name: 'Clube Ágora' }, bruno);
    // Sent one after the other: the queue is worked oldest first.
    await test.db
      .update(places)
      .set({ createdAt: new Date(now.getTime() + 1000) })
      .where(eq(places.id, second.id));
    const up = await send({ name: 'Bar da Rolagem' });
    await approvePlace(test.db, admin, up.id, { now });

    const waiting = await list();
    expect(waiting).toMatchObject({ status: 'pending', total: 2, pages: 1 });
    expect(waiting!.rows.map((row) => [row.name, row.submitter])).toEqual([
      ['Taverna do Dado', 'ana'],
      ['Clube Ágora', 'bruno'],
    ]);
    expect(waiting!.rows[0]).toMatchObject({ id: first.id, city: 'Recife', reports: 0 });
    expect((await list('status=up'))!.rows.map((row) => row.name)).toEqual(['Bar da Rolagem']);
    expect((await list('status=all'))!.total).toBe(3);
  });

  it('finds a place by name, city or @ of who sent it, and lists the removed ones', async () => {
    const first = await send();
    await send({ name: 'Clube Ágora', postalCode: '01001-000' }, bruno);
    expect((await list('q=paulo'))!.rows.map((row) => row.name)).toEqual(['Clube Ágora']);
    expect((await list('q=@ana'))!.rows.map((row) => row.name)).toEqual(['Taverna do Dado']);
    await removePlace(test.db, admin, first.id, { reason: 'spam', note: '' }, { now });
    expect((await list('status=removed'))!.rows.map((row) => row.name)).toEqual([
      'Taverna do Dado',
    ]);
  });

  it('answers null past the last page, and is for admins only', async () => {
    expect(await list('page=2')).toBeNull();
    await expect(listAdminPlaces(test.db, ana, new URLSearchParams())).rejects.toThrow(Forbidden);
  });
});

describe('the bell', () => {
  const stored = async (eventId: string) => {
    const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
    return { ...row, attempts: 0 } as unknown as StoredEvent;
  };
  const bell = async () =>
    (await test.db.select().from(notifications)).map(({ recipientId, link, metadata }) => ({
      recipientId,
      link,
      metadata,
    }));

  it('tells the submitter their place was approved, linked to its page', async () => {
    const { id: placeId } = await send();
    const eventIds = await approvePlace(test.db, admin, placeId, { now });
    await moderationHandler.handle(await stored(eventIds.at(-1)!), test.db);
    expect(await bell()).toEqual([
      {
        recipientId: ana.id,
        link: '/pp/taverna-do-dado',
        metadata: { placeId, placeApproved: 'Taverna do Dado' },
      },
    ]);
  });

  it('tells the submitter why it was turned down, with the note', async () => {
    const { id: placeId } = await send();
    const eventIds = await removePlace(
      test.db,
      admin,
      placeId,
      { reason: 'not_public', note: 'É uma casa' },
      { now },
    );
    await moderationHandler.handle(await stored(eventIds.at(-1)!), test.db);
    expect(await bell()).toEqual([
      {
        recipientId: ana.id,
        link: null,
        metadata: {
          placeId,
          placeRemoved: 'Taverna do Dado',
          reason: 'not_public',
          note: 'É uma casa',
        },
      },
    ]);
  });

  it('tells nobody when the submitter withdrew it', async () => {
    const { id: placeId } = await send();
    await withdrawPlace(test.db, ana, placeId, { now });
    const [event] = await test.db.select().from(events).where(eq(events.type, 'PlaceRemoved'));
    await moderationHandler.handle(await stored(event.id), test.db);
    expect(await bell()).toEqual([]);
  });
});

describe('reports on a place', () => {
  const reporters = [10, 11, 12, 13, 14, 15, 16].map(member);
  const listed = async () => {
    const { id: placeId } = await send();
    await approvePlace(test.db, admin, placeId, { now });
    return placeId;
  };
  const report = (placeId: string, actor: Actor) =>
    filePlaceReport(test.db, actor, placeId, { reason: 'place_closed', details: '' }, { now });
  const stored = async (eventId: string) => {
    const [row] = await test.db.select().from(events).where(eq(events.id, eventId));
    return { ...row, attempts: 0 } as unknown as StoredEvent;
  };

  it('is refused for whoever sent it, for a place not listed, and twice from one member', async () => {
    const placeId = await listed();
    await expect(report(placeId, ana)).rejects.toThrow(Forbidden);
    await report(placeId, bruno);
    await expect(report(placeId, bruno)).rejects.toMatchObject({ message: 'already_reported' });
    const { id: waiting } = await send({ name: 'Outro' });
    await expect(report(waiting, bruno)).rejects.toThrow(NotFound);
  });

  it('keeps the place public at five, and hides it once at the sixth', async () => {
    const placeId = await listed();
    for (const actor of reporters.slice(0, 5)) await report(placeId, actor);
    expect((await placeAt(placeId)).hiddenAt).toBeNull();

    const eventIds = await report(placeId, reporters[5]);
    expect(await placeAt(placeId)).toMatchObject({ hiddenAt: now, hiddenReason: 'reports' });
    const hidden = await test.db.select().from(events).where(eq(events.type, 'PlaceHidden'));
    expect(hidden).toHaveLength(1);
    expect(eventIds).toContain(hidden[0].id);
    // Hidden, it takes no more reports, so it cannot alert twice.
    await expect(report(placeId, reporters[6])).rejects.toThrow(NotFound);
  });

  it('hides it once when the last reports land together', async () => {
    const placeId = await listed();
    for (const actor of reporters.slice(0, 4)) await report(placeId, actor);
    const settled = await Promise.allSettled(
      reporters.slice(4).map((actor) => report(placeId, actor)),
    );
    expect(settled.filter((result) => result.status === 'fulfilled').length).toBeGreaterThanOrEqual(
      2,
    );
    expect(await test.db.select().from(events).where(eq(events.type, 'PlaceHidden'))).toHaveLength(
      1,
    );
  });

  it('does not count dismissed reports', async () => {
    const placeId = await listed();
    for (const actor of reporters.slice(0, 5)) await report(placeId, actor);
    await test.db.update(reports).set({ status: 'dismissed' }).where(eq(reports.targetId, placeId));
    await report(placeId, reporters[5]);
    expect((await placeAt(placeId)).hiddenAt).toBeNull();
  });

  it('alerts every admin and tells the submitter, then restoring dismisses the reports and lists it again', async () => {
    const placeId = await listed();
    let eventIds: string[] = [];
    for (const actor of reporters.slice(0, 6)) eventIds = await report(placeId, actor);
    await placeAlertHandler.handle(await stored(eventIds.at(-1)!), test.db);
    const bell = await test.db.select().from(notifications);
    expect(
      bell
        .map(({ recipientId, type, link }) => ({ recipientId, type, link }))
        .sort((a, b) => a.type.localeCompare(b.type)),
    ).toEqual([
      { recipientId: ana.id, type: 'moderation_notice', link: null },
      { recipientId: admin.id, type: 'place_hidden_alert', link: '/admin/places?status=reported' },
    ]);
    expect(bell.every((row) => row.actorId === null)).toBe(true);
    expect(
      (await listAdminPlaces(test.db, admin, new URLSearchParams('status=reported')))!.rows[0],
    ).toMatchObject({ id: placeId, reports: 6 });

    await expect(restorePlace(test.db, ana, placeId, { note: '' })).rejects.toThrow(Forbidden);
    const restored = await restorePlace(test.db, admin, placeId, { note: 'Está aberto' }, { now });
    expect(await placeAt(placeId)).toMatchObject({ hiddenAt: null, hiddenReason: null });
    const closed = await test.db.select().from(reports).where(eq(reports.targetId, placeId));
    expect(
      closed.every((row) => row.status === 'dismissed' && row.resolutionNote === 'Está aberto'),
    ).toBe(true);
    await placeAlertHandler.handle(await stored(restored.at(-1)!), test.db);
    const [notice] = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.eventId, restored.at(-1)!));
    expect(notice).toMatchObject({ recipientId: ana.id, link: '/pp/taverna-do-dado' });
    await expect(restorePlace(test.db, admin, placeId, { note: '' })).rejects.toMatchObject({
      message: 'not_hidden',
    });
  });
});
