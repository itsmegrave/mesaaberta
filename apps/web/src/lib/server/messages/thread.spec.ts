import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  conversationMembers,
  conversations,
  messages,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { apiOver } from '../db/test-api';
import { loadChatThread } from './thread';

const ana = '00000000-0000-4000-8000-000000000e11';
const bia = '00000000-0000-4000-8000-000000000e12';
const cris = '00000000-0000-4000-8000-000000000e13';
let test: Awaited<ReturnType<typeof createTestDb>>;
let conversationId: string;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
    { id: cris, username: 'cris' },
  ]);
  const [conversation] = await test.db
    .insert(conversations)
    .values({ kind: 'direct', pairKey: [ana, bia].sort().join(':') } as never)
    .returning();
  conversationId = conversation.id;
  await test.db.insert(conversationMembers).values([
    { conversationId, profileId: ana, lastReadAt: new Date('2026-10-01T10:00:00Z') },
    { conversationId, profileId: bia },
  ]);
  await test.db.insert(messages).values({
    conversationId,
    senderId: ana,
    body: 'Oi!',
    createdAt: new Date('2026-10-01T09:00:00Z'),
  });
});
afterAll(() => test.close());

// The api Worker opens the thread over the test database.
const as = (id: string) =>
  ({
    locals: {
      env: apiOver(test.db),
      log: { warn: vi.fn() },
      flags: { isEnabled: async () => false },
      getUser: async () => ({ id }),
      getProfile: async () => ({ id, username: 'x', role: 'member', status: 'active' }),
    },
    url: new URL(`https://x.test/m/${conversationId}`),
  }) as never;

describe('the chat thread load', () => {
  it('reads the thread from the api, with its dates as dates', async () => {
    const data = await loadChatThread(as(bia), conversationId);
    expect(data.viewerId).toBe(bia);
    expect(data.messages).toMatchObject([{ body: 'Oi!', own: false }]);
    expect(data.messages[0].createdAt).toEqual(new Date('2026-10-01T09:00:00Z'));
    expect(data.conversation.other?.lastReadAt).toEqual(new Date('2026-10-01T10:00:00Z'));
    expect(data.context).toBeNull();
    expect(data.safety).toBe(false);
  });

  it('answers 404 to someone who is not in the conversation', async () => {
    await expect(loadChatThread(as(cris), conversationId)).rejects.toMatchObject({ status: 404 });
  });
});
