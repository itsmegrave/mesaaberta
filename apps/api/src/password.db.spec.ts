import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { passwordSetupCodes, profiles } from '@mesaaberta/db/schema';
import type { Mail } from '@mesaaberta/core/server/mail/mailer';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { passwordRoutes } from './password';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000ca1';
const bia = '00000000-0000-4000-8000-000000000ca2';
const env = {
  DATABASE_URL: 'postgres://test',
  SUPABASE_URL: 'https://auth.test',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
};

// A Supabase Auth that knows two people: Ana (Google only) and Bia (already has a password).
const users: Record<string, { id: string; email: string; identities: { provider: string }[] }> = {
  'token-ana': { id: ana, email: 'ana@example.com', identities: [{ provider: 'google' }] },
  'token-bia': { id: bia, email: 'bia@example.com', identities: [{ provider: 'email' }] },
};
let sent: Mail[] = [];
let calls: string[] = [];
let weak = false;

const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const token = new Headers(init?.headers).get('authorization')?.replace('Bearer ', '') ?? '';
  calls.push(`${init?.method ?? 'GET'} ${url.pathname}${url.search}`);
  const user = users[token];
  if (!user) return Response.json({ code: 401 }, { status: 401 });
  if (url.pathname === '/auth/v1/user' && (init?.method ?? 'GET') === 'GET')
    return Response.json(user);
  if (url.pathname === '/auth/v1/user' && init?.method === 'PUT')
    return weak
      ? Response.json({ error_code: 'weak_password' }, { status: 422 })
      : Response.json(user);
  return Response.json({});
}) as typeof fetch;

const mailer = { send: async (mail: Mail) => void sent.push(mail) };
const app = () =>
  passwordRoutes((() => ({ db: test.db, close: async () => {} })) as never, { mailer, request });
const post = (path: string, body: unknown, who?: { actor?: string; token?: string }) =>
  app().request(
    path,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(who?.actor ? { [ACTOR_HEADER]: who.actor } : {}),
        ...(who?.token ? { authorization: `Bearer ${who.token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    env,
  );
const ana_ = { actor: ana, token: 'token-ana' };
const codeOf = () => /é (\d{6})\./.exec(sent.at(-1)!.text)![1];
const row = async () =>
  (await test.db.select().from(passwordSetupCodes).where(eq(passwordSetupCodes.profileId, ana)))[0];

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  sent = [];
  calls = [];
  weak = false;
  await test.db.delete(passwordSetupCodes);
});

describe('api password routes over a database', () => {
  it('e-mails a code, stores only its hash, then sets the password with it', async () => {
    expect((await post('/code', {}, ana_)).status).toBe(200);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ana@example.com');
    const code = codeOf();
    expect((await row()).codeHash).not.toContain(code);

    const response = await post('/', { password: 'a long password', code }, ana_);

    expect(response.status).toBe(200);
    expect(calls).toContain('PUT /auth/v1/user');
    expect(calls).toContain('POST /auth/v1/logout?scope=others');
    expect(await row()).toBeUndefined();
  });

  it('refuses a wrong code and a used-up code, even the right one afterwards', async () => {
    await post('/code', {}, ana_);
    const code = codeOf();
    const wrong = code === '000000' ? '111111' : '000000';

    const first = await post('/', { password: 'a long password', code: wrong }, ana_);
    expect(first.status).toBe(400);
    expect(await first.json()).toMatchObject({ field: 'code', message: 'wrong_code' });

    for (let i = 0; i < 4; i++) await post('/', { password: 'a long password', code: wrong }, ana_);
    const late = await post('/', { password: 'a long password', code }, ana_);
    expect(await late.json()).toMatchObject({ field: 'code', message: 'code_expired' });
    expect(calls).not.toContain('PUT /auth/v1/user');
  });

  it('refuses without a code having been asked for', async () => {
    const response = await post('/', { password: 'a long password', code: '123456' }, ana_);

    expect(await response.json()).toMatchObject({ field: 'code', message: 'code_expired' });
  });

  it('makes the person wait a minute before another code', async () => {
    await post('/code', {}, ana_);
    const again = await post('/code', {}, ana_);

    expect(again.status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it('does not hand out a fresh code to someone who spent every guess', async () => {
    await post('/code', {}, ana_);
    const wrong = codeOf() === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await post('/', { password: 'a long password', code: wrong }, ana_);
    // A minute on, as if the person waited before asking again.
    await test.db
      .update(passwordSetupCodes)
      .set({ sentAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(passwordSetupCodes.profileId, ana));

    const again = await post('/code', {}, ana_);

    expect(again.status).toBe(429);
    expect(((await again.json()) as { retryAfter: number }).retryAfter).toBeGreaterThan(3000);
    expect(sent).toHaveLength(1);
  });

  it('keeps the guess when the password was too weak', async () => {
    await post('/code', {}, ana_);
    weak = true;
    const response = await post('/', { password: 'a long password', code: codeOf() }, ana_);

    expect(await response.json()).toMatchObject({ field: 'password', message: 'weak_password' });
    expect((await row()).attempts).toBe(0);
  });

  it('refuses a token that is not the actor’s', async () => {
    const response = await post('/code', {}, { actor: ana, token: 'token-bia' });

    expect(response.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('refuses an account that already signs in with a password', async () => {
    const response = await post('/code', {}, { actor: bia, token: 'token-bia' });

    expect(await response.json()).toMatchObject({ field: 'password', message: 'already_set' });
    expect(sent).toHaveLength(0);
  });

  it('answers 503 without the token, 400 for a bad form and 401 without an actor', async () => {
    expect((await post('/code', {}, { actor: ana })).status).toBe(503);
    expect((await post('/', { password: 'short', code: '123456' }, ana_)).status).toBe(400);
    expect((await post('/code', {}, { token: 'token-ana' })).status).toBe(401);
  });
});
