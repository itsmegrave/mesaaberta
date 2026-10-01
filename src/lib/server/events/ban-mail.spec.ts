import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { SupabaseAdmin } from '../auth/admin-client';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Mail } from '../mail/mailer';
import { banMail, createBanMailHandler } from './ban-mail';
import type { StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const userId = '00000000-0000-4000-8000-000000003001';
const config = {
  RESEND_FROM: 'Mesa Aberta <ola@mesaaberta.app>',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  APP_ORIGIN: 'https://mesaaberta.app',
};
const admin: SupabaseAdmin = {
  auth: {
    admin: {
      getUserById: vi.fn(async () => ({
        data: { user: { email: 'ana@example.com' } },
        error: null,
      })),
      deleteUser: vi.fn(),
    },
  },
};
const banned = (until: string | null): StoredEvent => ({
  id: '00000000-0000-4000-8000-000000003099',
  type: 'AccountBanned',
  payload: { profileId: userId, until, reportId: null },
  actorId: null,
  createdAt: new Date(),
  attempts: 0,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: userId, username: 'ana', name: 'Ana' });
});
afterAll(() => test.close());

const run = async (event: StoredEvent, extra: Record<string, string> = {}) => {
  const sent: Mail[] = [];
  const mailer = { send: vi.fn(async (mail: Mail) => void sent.push(mail)) };
  await createBanMailHandler({ ...config, ...extra }, fetch, admin, mailer).handle(event, test.db);
  return sent;
};

describe('the ban e-mail', () => {
  it('tells a temporarily banned person why, and until when', async () => {
    await test.db
      .update(profiles)
      .set({ status: 'suspended', bannedAt: new Date(), banReason: 'Ofensas no chat.' })
      .where(eq(profiles.id, userId));

    const [mail] = await run(banned('2026-10-08T15:00:00.000Z'));

    expect(mail).toMatchObject({
      to: 'ana@example.com',
      subject: 'Sua conta foi suspensa temporariamente',
    });
    expect(mail.text).toContain('Ofensas no chat.');
    expect(mail.text).toContain('8 de outubro de 2026');
    // A retry of the same event is the same message to the provider, which drops the repeat.
    expect(mail.idempotencyKey).toBe(`ban-${banned(null).id}`);
  });

  it('sends the hosted template with its own variables once its id is set', async () => {
    await test.db
      .update(profiles)
      .set({ status: 'suspended', bannedAt: new Date(), banReason: 'Ofensas no chat.' })
      .where(eq(profiles.id, userId));

    const [mail] = await run(banned(null), { RESEND_TEMPLATE_ACCOUNT_BANNED: 'tpl-ban' });

    expect(mail.template).toEqual({
      id: 'tpl-ban',
      variables: {
        RECIPIENT_NAME: 'Ana',
        BAN_SUMMARY: 'Sua conta na Mesa Aberta foi banida pela moderação de forma permanente.',
        BAN_REASON: 'Ofensas no chat.',
        FALLBACK_TEXT: expect.stringContaining('Ofensas no chat.'),
      },
    });
  });

  it('says a permanent ban is for good', () => {
    const mail = banMail({ name: 'Ana', until: null, reason: 'Golpe' });
    expect(mail.subject).toBe('Sua conta foi banida');
    expect(mail.text).toContain('de forma permanente');
  });

  it('sends nothing once the ban was revoked before the dispatch', async () => {
    await test.db
      .update(profiles)
      .set({ status: 'active', bannedAt: null, banReason: null })
      .where(eq(profiles.id, userId));

    expect(await run(banned(null))).toEqual([]);
  });
});
