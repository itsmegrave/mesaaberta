import { expect, it } from 'vitest';
import { playerInvitationMail } from '@mesaaberta/core/server/events/player-invitations';
it('asks for consent with the GM, deadline and decision link without a calendar attachment', () => {
  const mail = playerInvitationMail({
    name: 'ana',
    gm: 'mestre',
    title: 'A mesa',
    startsAt: new Date('2099-01-01T20:00:00Z'),
    expiresAt: new Date('2098-12-31T20:00:00Z'),
    timezone: 'UTC',
    url: 'https://mesa.test/u/profile/invitations/id',
  });
  expect(mail.text).toContain('@mestre');
  expect(mail.text).toContain('https://mesa.test/u/profile/invitations/id');
  expect(mail.text).toContain('reservada');
  expect(mail).not.toHaveProperty('attachments');
});

import { afterAll, beforeAll, describe, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import {
  profiles,
  gameTables,
  systems,
  playerInvitations,
  events,
  notifications,
} from '@mesaaberta/core/server/db/schema';
import {
  createPlayerInvitationMailHandler,
  playerInvitationNotificationHandler,
} from '@mesaaberta/core/server/events/player-invitations';
import { bellHandlers } from '@mesaaberta/core/server/events/handlers';
import {
  invitePlayer,
  respondToInvitation,
  setInvitationsEnabled,
  setGmInviteBlock,
} from '@mesaaberta/core/server/invitations/service';
import type { SupabaseAdmin } from '@mesaaberta/core/server/auth/admin-client';
import type { Mail } from '@mesaaberta/core/server/mail/mailer';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = { id: crypto.randomUUID(), role: 'member', status: 'active' } as const;
const player = { id: crypto.randomUUID(), role: 'member', status: 'active' } as const;
const config = {
  RESEND_FROM: 'Mesa <mail@example.test>',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SECRET_KEY: 'test',
  APP_ORIGIN: 'https://mesa.test',
};
const admin: SupabaseAdmin = {
  auth: {
    admin: {
      getUserById: vi.fn(async () => ({
        data: { user: { email: 'player@example.test' } },
        error: null,
      })),
      deleteUser: vi.fn(),
    },
  },
};
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm.id, username: 'mail-gm' },
    { id: player.id, username: 'mail-player' },
  ]);
});
afterAll(() => test.close());
let sequence = 0;
async function setup() {
  await test.db.delete(events);
  await test.db
    .update(profiles)
    .set({ invitationsEnabled: true })
    .where(eq(profiles.id, player.id));
  const [system] = await test.db.select().from(systems).limit(1);
  const [table] = await test.db
    .insert(gameTables)
    .values({
      gmId: gm.id,
      systemId: system.id,
      slug: `mail-invitation-${++sequence}`,
      title: 'Public title',
      kind: 'one_shot',
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      capacity: 1,
      joinDetails: 'private-location',
      welcomeMessage: 'secret-welcome',
    })
    .returning();
  const result = await invitePlayer(test.db, gm, table.slug, player.id);
  const [event] = await test.db.select().from(events).where(eq(events.id, result.eventIds[0]));
  return { table, result, event: event as StoredEvent };
}
async function deliver(event: StoredEvent, extra = {}) {
  const sent: Mail[] = [];
  const handler = createPlayerInvitationMailHandler({ ...config, ...extra }, fetch, admin, {
    send: async (mail) => {
      sent.push(mail);
    },
  });
  await handler.handle(event, test.db);
  return sent;
}
describe('invitation outbox delivery', () => {
  it('resolves email only at delivery, excludes private access, and retries with the same key', async () => {
    const { event } = await setup();
    const [first] = await deliver(event, { RESEND_TEMPLATE_PLAYER_INVITATION: 'tpl-consent' });
    const [retry] = await deliver(event);
    expect(first.to).toBe('player@example.test');
    expect(first.idempotencyKey).toBe(retry.idempotencyKey);
    expect(first.template?.variables).toMatchObject({
      GM_NAME: 'mail-gm',
      TABLE_TITLE: 'Public title',
      CONTEXT: 'PLAYER_INVITATION',
    });
    expect(JSON.stringify(first)).not.toMatch(/private-location|secret-welcome/);
    expect(first.attachments).toBeUndefined();
    expect(JSON.stringify(event.payload)).not.toContain('@');
  });
  it.each(['cancelled', 'expired'] as const)(
    'suppresses delivery after invitation becomes %s',
    async (status) => {
      const { event, result } = await setup();
      await test.db
        .update(playerInvitations)
        .set({ status })
        .where(eq(playerInvitations.id, result.invitationId));
      expect(await deliver(event)).toEqual([]);
    },
  );
  it('suppresses a reservation at its exact expiry without requiring a cron run', async () => {
    const { event, result } = await setup();
    const expiry = new Date();
    await test.db
      .update(playerInvitations)
      .set({ createdAt: new Date(expiry.getTime() - 60_000), expiresAt: expiry })
      .where(eq(playerInvitations.id, result.invitationId));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(expiry);
    try {
      expect(await deliver(event)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
  it('suppresses delivery after opt-out and a GM block', async () => {
    const { event } = await setup();
    await setInvitationsEnabled(test.db, player, false);
    expect(await deliver(event)).toEqual([]);
    await setInvitationsEnabled(test.db, player, true);
    const second = await setup();
    await setGmInviteBlock(test.db, player, gm.id, true);
    expect(await deliver(second.event)).toEqual([]);
    await setGmInviteBlock(test.db, player, gm.id, false);
  });
  it.each(['opt_out', 'block', 'accept'] as const)(
    'suppresses a stale email when %s completes during the Auth address lookup',
    async (change) => {
      const { event, result } = await setup();
      vi.mocked(admin.auth.admin.getUserById).mockImplementationOnce(async () => {
        if (change === 'opt_out') await setInvitationsEnabled(test.db, player, false);
        else if (change === 'block') await setGmInviteBlock(test.db, player, gm.id, true);
        else await respondToInvitation(test.db, player, result.invitationId, 'accept');
        return { data: { user: { email: 'player@example.test' } }, error: null };
      });
      try {
        expect(await deliver(event)).toEqual([]);
      } finally {
        if (change === 'block') await setGmInviteBlock(test.db, player, gm.id, false);
      }
    },
  );
  it('records the recipient bell once and the accepted GM bell once across all handlers and retries', async () => {
    const { event, result } = await setup();
    await playerInvitationNotificationHandler.handle(event, test.db);
    await playerInvitationNotificationHandler.handle(event, test.db);
    expect(
      await test.db.select().from(notifications).where(eq(notifications.eventId, event.id)),
    ).toHaveLength(1);
    const accepted = await respondToInvitation(test.db, player, result.invitationId, 'accept');
    for (const id of accepted.eventIds) {
      const [stored] = await test.db.select().from(events).where(eq(events.id, id));
      for (const handler of bellHandlers) {
        if (handler.types.includes(stored.type as StoredEvent['type'])) {
          await handler.handle(stored as StoredEvent, test.db);
          await handler.handle(stored as StoredEvent, test.db);
        }
      }
    }
    const gmNotifications = await test.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, gm.id));
    expect(gmNotifications).toHaveLength(1);
    expect(gmNotifications[0].type).toBe('player_joined');
  });
});
