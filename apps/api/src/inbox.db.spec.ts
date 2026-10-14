import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  conversationMembers,
  conversations,
  messages,
  notifications,
  profiles,
} from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { inboxRoutes } from './inbox';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000da1';
const bia = '00000000-0000-4000-8000-000000000da2';
const cris = '00000000-0000-4000-8000-000000000da3';
const env = { DATABASE_URL: 'postgres://test' };
let conversationId: string;
let notificationId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
    { id: cris, username: 'cris', role: 'member' },
  ]);
  const [conversation] = await test.db
    .insert(conversations)
    .values({ kind: 'direct', pairKey: [ana, bia].sort().join(':') } as never)
    .returning();
  conversationId = conversation.id;
  await test.db.insert(conversationMembers).values([
    { conversationId, profileId: ana },
    { conversationId, profileId: bia },
  ]);
  const [notification] = await test.db
    .insert(notifications)
    .values({
      recipientId: ana,
      category: 'messages',
      type: 'message_received',
      link: '/messages/x',
    } as never)
    .returning();
  notificationId = notification.id;
});
afterAll(() => test.close());

const app = () => inboxRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (action: string, body: unknown, actor?: string) =>
  app().request(
    `/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api inbox routes over a database', () => {
  it('sends a message as the actor and notifies the other member', async () => {
    const response = await post('send', { conversationId, body: 'Oi!' }, ana);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [] });
    const rows = await test.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(rows).toMatchObject([{ senderId: ana, body: 'Oi!' }]);
  });

  it('answers 404 to someone who is not in the conversation', async () => {
    const response = await post('send', { conversationId, body: 'Intruso' }, cris);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('refuses an empty body', async () => {
    expect((await post('send', { conversationId, body: '  ' }, ana)).status).toBe(400);
  });

  it('mutes for the actor only', async () => {
    expect((await post('mute', { conversationId, muted: true }, bia)).status).toBe(200);
    const members = await test.db
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    expect(members.find((m) => m.profileId === bia)?.mutedAt).not.toBeNull();
    expect(members.find((m) => m.profileId === ana)?.mutedAt).toBeNull();
  });

  it('opens a notification of the actor and answers its link; another person gets null', async () => {
    const other = await post('open', { id: notificationId }, bia);
    expect(await other.json()).toEqual({ eventIds: [], link: null });

    const response = await post('open', { id: notificationId }, ana);
    expect(await response.json()).toEqual({ eventIds: [], link: '/messages/x' });
    const [row] = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));
    expect(row.readAt).not.toBeNull();
  });

  it('opens the direct conversation with someone, and refuses oneself', async () => {
    const opened = await post('direct', { recipientId: bia }, ana);

    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({ conversationId });
    expect((await post('direct', { recipientId: ana }, ana)).status).toBe(403);
    expect((await post('direct', { recipientId: 'nope' }, ana)).status).toBe(400);
  });

  it('answers 404 for an unknown action and 401 without an actor', async () => {
    expect((await post('explode', {}, ana)).status).toBe(404);
    expect((await post('readAll', {})).status).toBe(401);
    expect((await post('readAll', {}, ana)).status).toBe(200);
  });
});
