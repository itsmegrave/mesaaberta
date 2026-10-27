import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  conversationMembers,
  conversations,
  gameTables,
  messages,
  profileBlocks,
  profiles,
  reports,
  systems,
} from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { messageRoutes } from './messages';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000e01';
const bia = '00000000-0000-4000-8000-000000000e02';
const cris = '00000000-0000-4000-8000-000000000e03';
const env = { DATABASE_URL: 'postgres://test' };
let conversationId: string;
let messageId: string;

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
  const [message] = await test.db
    .insert(messages)
    .values({ conversationId, senderId: bia, body: 'Oi, Ana!' })
    .returning();
  messageId = message.id;

  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    slug: 'mesa-chat',
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 3,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: ana,
    systemId: system.id,
  } as never);
});
afterAll(() => test.close());

const app = () => messageRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string | null, body?: unknown) =>
  app().request(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(actor ? { [ACTOR_HEADER]: actor } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

describe('api message routes over a database', () => {
  it('refuses a request without an actor', async () => {
    expect((await call('/inbox', null)).status).toBe(401);
  });

  it('lists the inbox of the actor, and a page past the last is a 404', async () => {
    const response = await call('/inbox?page=1', ana);
    expect(response.status).toBe(200);
    const inbox = await response.json();
    expect(inbox).toMatchObject({ page: 1, total: 1, items: [{ id: conversationId, unread: 1 }] });
    expect((await call('/inbox?page=2', ana)).status).toBe(404);
  });

  it('lists the messages for a member and answers 404 to anyone else', async () => {
    const response = await call(`/${conversationId}`, ana);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      messages: [{ body: 'Oi, Ana!', own: false }],
      hasMore: false,
    });
    expect((await call(`/${conversationId}`, cris)).status).toBe(404);
    expect((await call('/not-a-conversation', ana)).status).toBe(404);
    expect((await call(`/${conversationId}?before=whenever`, ana)).status).toBe(400);
  });

  it('opens a thread, which reads it, with the table it is about', async () => {
    const response = await call(`/${conversationId}/open`, ana, { about: 'mesa-chat' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      conversation: { id: conversationId, kind: 'direct', other: { username: 'bia' } },
      messages: [{ body: 'Oi, Ana!' }],
      context: { slug: 'mesa-chat', title: 'Mesa' },
    });
    const [membership] = await test.db
      .select({ lastReadAt: conversationMembers.lastReadAt })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.profileId, ana),
        ),
      );
    expect(membership.lastReadAt).not.toBeNull();
    expect((await call(`/${conversationId}/open`, cris, {})).status).toBe(404);
  });

  it('marks a conversation read', async () => {
    const response = await call(`/${conversationId}/read`, bia, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [] });
  });

  it('opens a table chat for its GM and answers 404 to someone with no seat', async () => {
    const response = await call('/tables/mesa-chat', ana, {});
    expect(response.status).toBe(200);
    const { conversationId: chat } = await response.json();
    const members = await test.db
      .select({ profileId: conversationMembers.profileId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, chat));
    expect(members).toEqual([{ profileId: ana }]);
    expect((await call('/tables/mesa-chat', cris, {})).status).toBe(404);
    expect((await call('/tables/no-such-table', ana, {})).status).toBe(404);
  });

  it('files a report on a message in the conversation', async () => {
    const response = await call(`/${conversationId}/report`, ana, {
      targetType: 'message',
      messageId,
      profileId: '',
      reason: 'spam',
      details: '',
    });
    expect(response.status).toBe(200);
    const { eventIds } = await response.json();
    expect(eventIds).toHaveLength(1);
    expect(await test.db.select().from(reports)).toHaveLength(1);
    expect(
      (
        await call(`/${conversationId}/report`, cris, {
          targetType: 'message',
          messageId,
          reason: 'spam',
          details: '',
        })
      ).status,
    ).toBe(404);
  });

  it('blocks and unblocks someone, and lists who the actor blocked', async () => {
    expect((await call('/block', ana, { profileId: bia, blocked: true })).status).toBe(200);
    expect(await test.db.select().from(profileBlocks)).toMatchObject([
      { blockerId: ana, blockedId: bia },
    ]);
    expect(await (await call('/blocked', ana)).json()).toMatchObject([
      { id: bia, username: 'bia' },
    ]);
    expect((await call('/block', ana, { profileId: bia, blocked: false })).status).toBe(200);
    expect(await test.db.select().from(profileBlocks)).toEqual([]);
    expect((await call('/block', ana, { profileId: ana, blocked: true })).status).toBe(403);
    expect((await call('/block', ana, { profileId: bia })).status).toBe(400);
  });
});
