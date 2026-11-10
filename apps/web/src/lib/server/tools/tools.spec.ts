import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { events, notifications, profiles, tools } from '@mesaaberta/core/server/db/schema';
import { moderationHandler } from '@mesaaberta/core/server/events/moderation';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { Forbidden, Invalid } from '@mesaaberta/core/server/errors';
import {
  approveTool,
  listAdminTools,
  listTools,
  pendingToolCount,
  removeTool,
  suggestTool,
  updateTool,
} from '@mesaaberta/core/server/tools/service';
import type { ToolInput } from '@mesaaberta/core/tools/schema';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-11-07T15:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000019${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);

const input = (over: Partial<ToolInput> = {}): ToolInput => ({
  name: "Let's Role",
  siteUrl: 'lets-role.com',
  kind: 'vtt',
  description: 'Mesa virtual no navegador com fichas que você mesmo monta.',
  ...over,
});
const suggest = (over: Partial<ToolInput> = {}, actor: Actor = ana) =>
  suggestTool(test.db, actor, input(over), { logoPath: `tools/${actor.id}/a.png`, now });
const shown = async (viewerId: string | null = null) => {
  const list = await listTools(test.db, { viewerId, now });
  return {
    pending: list.pending.map((tool) => tool.name),
    groups: list.groups.map((group) => [group.kind, group.tools.map((tool) => tool.name)]),
  };
};
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

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bruno' },
    { id: id(99), username: 'admin', role: 'admin' },
  ]);
});
afterAll(() => test.close());

describe('the seeded list', () => {
  it('starts with the table platforms, approved and grouped by kind, with their logos', async () => {
    const list = await listTools(test.db, { now });
    expect(list.groups.map((group) => group.kind)).toEqual(['vtt', 'chat', 'call', 'helper']);
    const all = list.groups.flatMap((group) => group.tools);
    expect(all).toHaveLength(15);
    expect(all.find((tool) => tool.slug === '5e-to-daggerheart')).toMatchObject({
      kind: 'helper',
      logoPath: '/tools/5e-to-daggerheart.svg',
      platformSlug: null,
    });
    expect(all.find((tool) => tool.slug === 'discord')).toMatchObject({
      kind: 'chat',
      siteUrl: 'https://discord.com',
      logoPath: '/tools/discord.svg',
      platformSlug: 'discord',
      pending: false,
    });
    // No square logo to ship: the card shows the initial.
    expect(all.find((tool) => tool.slug === 'talespire')?.logoPath).toBeNull();
    expect(await pendingToolCount(test.db)).toBe(0);
  });
});

describe('a suggested tool', () => {
  beforeEach(async () => {
    await test.db.delete(notifications);
    await test.db.delete(tools);
    await test.db.delete(events);
  });

  it('waits for an admin: only whoever suggested it sees it, under "Suas sugestões"', async () => {
    await suggest();
    expect(await shown()).toEqual({ pending: [], groups: [] });
    expect(await shown(bruno.id)).toEqual({ pending: [], groups: [] });
    expect(await shown(ana.id)).toEqual({ pending: ["Let's Role"], groups: [] });
    expect(await pendingToolCount(test.db)).toBe(1);
  });

  it('needs a signed-in member', async () => {
    await expect(suggestTool(test.db, null, input())).rejects.toBeInstanceOf(Forbidden);
  });

  it('stores the site as a full address and refuses one already on the list', async () => {
    const { id: toolId } = await suggest();
    const [row] = await test.db.select().from(tools).where(eq(tools.id, toolId));
    expect(row).toMatchObject({ slug: 'lets-role', siteUrl: 'https://lets-role.com' });
    await expect(
      suggest({ name: 'Outro nome', siteUrl: 'https://LETS-ROLE.com/' }, bruno),
    ).rejects.toMatchObject({ field: 'siteUrl', message: 'tool_duplicate' });
    // A seeded tool counts too.
    await test.db.insert(tools).values({
      slug: 'discord',
      name: 'Discord',
      kind: 'chat',
      siteUrl: 'https://discord.com',
      description: 'Chat.',
      approvedAt: now,
    });
    await expect(suggest({ name: 'Discord', siteUrl: 'discord.com' }, bruno)).rejects.toMatchObject(
      { field: 'siteUrl', message: 'tool_duplicate' },
    );
  });

  it('goes on the page when an admin approves it, and whoever suggested it is told', async () => {
    const { id: toolId } = await suggest();
    const [eventId] = await approveTool(test.db, admin, toolId, { now });
    expect(await shown()).toEqual({ pending: [], groups: [['vtt', ["Let's Role"]]] });
    await moderationHandler.handle(await stored(eventId), test.db);
    expect(await bell()).toEqual([
      { recipientId: ana.id, link: '/tools', metadata: { toolId, toolApproved: "Let's Role" } },
    ]);
  });

  it('is approved by admins only, and once', async () => {
    const { id: toolId } = await suggest();
    await expect(approveTool(test.db, ana, toolId)).rejects.toBeInstanceOf(Forbidden);
    await approveTool(test.db, admin, toolId);
    await expect(approveTool(test.db, admin, toolId)).rejects.toBeInstanceOf(Invalid);
  });

  it('turned down, leaves the list and tells whoever suggested it why', async () => {
    const { id: toolId } = await suggest();
    const [eventId] = await removeTool(
      test.db,
      admin,
      toolId,
      { reason: 'off_topic', note: 'Não é para jogar' },
      { now },
    );
    expect(await shown(ana.id)).toEqual({ pending: [], groups: [] });
    await moderationHandler.handle(await stored(eventId), test.db);
    expect(await bell()).toEqual([
      {
        recipientId: ana.id,
        link: null,
        metadata: {
          toolId,
          toolRemoved: "Let's Role",
          reason: 'off_topic',
          note: 'Não é para jogar',
        },
      },
    ]);
    // Once it is off the list, the same site can be suggested again.
    await expect(suggest({}, bruno)).resolves.toBeTruthy();
  });

  it('is edited by an admin in place, and a new logo hands back the old one to delete', async () => {
    const { id: toolId } = await suggest();
    await approveTool(test.db, admin, toolId);
    await expect(updateTool(test.db, ana, toolId, input())).rejects.toBeInstanceOf(Forbidden);
    const { replacedLogo } = await updateTool(
      test.db,
      admin,
      toolId,
      input({ kind: 'helper', description: 'Fichas online.' }),
      { logoPath: `tools/${admin.id}/b.png`, now },
    );
    expect(replacedLogo).toBe(`tools/${ana.id}/a.png`);
    expect(await shown()).toEqual({ pending: [], groups: [['helper', ["Let's Role"]]] });
  });

  it('lists every tool for admins, those that wait first, with who suggested each', async () => {
    const { id: up } = await suggest({ name: 'Antigo', siteUrl: 'antigo.example' });
    await approveTool(test.db, admin, up);
    await suggest({}, bruno);
    await expect(listAdminTools(test.db, ana, new URLSearchParams())).rejects.toBeInstanceOf(
      Forbidden,
    );
    const all = await listAdminTools(test.db, admin, new URLSearchParams());
    expect(all.rows.map((row) => [row.name, row.submitter])).toEqual([
      ["Let's Role", 'bruno'],
      ['Antigo', 'ana'],
    ]);
    const waiting = await listAdminTools(test.db, admin, new URLSearchParams('status=pending'));
    expect(waiting.rows.map((row) => row.name)).toEqual(["Let's Role"]);
  });
});
