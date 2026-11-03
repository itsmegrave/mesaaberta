import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { notifications, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { Forbidden } from '@mesaaberta/core/server/errors';
import {
  listInbox,
  loadConversation,
  openAdminConversation,
  openDirect,
  sendMessage,
} from '@mesaaberta/core/server/messages/service';
import { setBlocked } from '@mesaaberta/core/server/blocks/service';

// "Mandar mensagem" in admin: an "[Admin] @username" conversation of its own, apart from the
// everyday direct one, that reaches people with direct messages off and lets them answer.

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000031${String(n).padStart(2, '0')}`;
const ana: Actor = { id: id(1), role: 'member', status: 'active' };
const bia: Actor = { id: id(2), role: 'member', status: 'active' };
const suspended: Actor = { id: id(3), role: 'member', status: 'suspended' };
const admin: Actor = { id: id(9), role: 'admin', status: 'active' };
let minute = 0;
const at = () => new Date(Date.UTC(2030, 0, 1, 12, minute++));

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana.id, username: 'ana-a', directMessagesEnabled: false },
    { id: bia.id, username: 'bia-a' },
    { id: suspended.id, username: 'suspended-a', status: 'suspended' },
    { id: admin.id, username: 'admin-a', role: 'admin' },
  ]);
});
afterAll(() => test.close());

describe('an admin conversation', () => {
  it('is apart from the everyday direct one, and the same one each time', async () => {
    const adminChat = await openAdminConversation(test.db, admin, bia.id);
    const everyday = await openDirect(test.db, admin, bia.id);

    expect(adminChat.id).not.toBe(everyday.id);
    expect((await openAdminConversation(test.db, admin, bia.id)).id).toBe(adminChat.id);
  });

  it('reaches someone with direct messages off, and they can answer', async () => {
    const chat = await openAdminConversation(test.db, admin, ana.id);
    await sendMessage(test.db, admin, chat.id, 'Oi, sobre o seu parceiro', { now: at() });
    await sendMessage(test.db, ana, chat.id, 'Pode falar', { now: at() });

    const seen = await loadConversation(test.db, ana, chat.id);
    expect(seen).toMatchObject({ admin: true, canSend: true, blocked: false });
    expect(seen.other).toMatchObject({ username: 'admin-a', acceptsDirect: true });
    const [item] = (await listInbox(test.db, ana.id)).items;
    expect(item).toMatchObject({ id: chat.id, admin: true, title: 'admin-a' });
    const [notice] = await test.db
      .select({ metadata: notifications.metadata })
      .from(notifications)
      .where(eq(notifications.recipientId, ana.id));
    expect(notice.metadata).toMatchObject({ conversationId: chat.id, admin: true });
  });

  it('stays in the inbox and takes messages after the person blocks the admin', async () => {
    const chat = await openAdminConversation(test.db, admin, bia.id);
    await sendMessage(test.db, admin, chat.id, 'Sobre a sua mesa', { now: at() });
    await setBlocked(test.db, bia, admin.id, true);

    expect((await listInbox(test.db, bia.id)).items.map((item) => item.id)).toContain(chat.id);
    await expect(
      sendMessage(test.db, bia, chat.id, 'Respondendo', { now: at() }),
    ).resolves.toBeDefined();
    await setBlocked(test.db, bia, admin.id, false);
  });

  it('is for admins only, never with oneself or a suspended account', async () => {
    await expect(openAdminConversation(test.db, ana, bia.id)).rejects.toThrow(Forbidden);
    await expect(openAdminConversation(test.db, admin, admin.id)).rejects.toThrow(Forbidden);
    await expect(openAdminConversation(test.db, admin, suspended.id)).rejects.toThrow(Forbidden);
  });

  it('is an everyday direct conversation as usual for the pair otherwise', async () => {
    const everyday = await openDirect(test.db, admin, bia.id);
    expect(await loadConversation(test.db, bia, everyday.id)).toMatchObject({ admin: false });
  });
});
