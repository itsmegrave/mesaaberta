import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { formatSession } from '../../tables/format';
import { TEMPLATE_VARIABLES } from '../mail/templates';
import { TITLE_TOKEN } from '$lib/tables/welcome';
import { createInviteHandler, inviteHandler } from './invites';
import type { SupabaseAdmin } from '../auth/admin-client';
import type { StoredEvent } from './types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000811';
const player = '00000000-0000-4000-8000-000000000812';
const tableId = '00000000-0000-4000-8000-000000000813';

const event = (type: StoredEvent['type']): StoredEvent =>
  ({
    id: '00000000-0000-4000-8000-000000000814',
    type,
    actorId: player,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    attempts: 0,
    payload: { tableId, slug: 'mesa', playerId: player },
  }) as StoredEvent;

beforeAll(async () => {
  test = await createTestDb();
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre' },
    { id: player, username: 'ana-souza', name: 'Ana' },
  ]);
  await test.db.insert(gameTables).values({
    id: tableId,
    slug: 'mesa',
    systemId: system.id,
    title: 'Mesa do Dragão',
    description: 'Uma aventura.',
    kind: 'one_shot',
    capacity: 4,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
  });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(registrations);
});

const env = {
  RESEND_API_KEY: 're_test',
  RESEND_FROM: 'Mesa Aberta <no-reply@mesaaberta.app>',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  APP_ORIGIN: 'https://mesaaberta.app',
};

const admin = (email = 'ana@example.com'): SupabaseAdmin => ({
  auth: {
    admin: {
      getUserById: vi.fn(async () => ({ data: { user: { email } }, error: null })),
      deleteUser: vi.fn(async () => ({ error: null })),
    },
  },
});

/** For events with more than one recipient: looks up each id's own address. */
const adminByRecipient = (byId: Record<string, string>): SupabaseAdmin => ({
  auth: {
    admin: {
      getUserById: vi.fn(async (id: string) => ({
        data: { user: { email: byId[id] } },
        error: null,
      })),
      deleteUser: vi.fn(async () => ({ error: null })),
    },
  },
});

/** TableCreated, TableUpdated and TableDisabled carry no `playerId`: their recipients come from the
 *  table's GM and, for the latter two, its confirmed players. */
const tableEvent = (type: 'TableCreated' | 'TableUpdated' | 'TableDisabled'): StoredEvent =>
  ({
    id: '00000000-0000-4000-8000-000000000815',
    type,
    actorId: gm,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    attempts: 0,
    payload: { tableId, slug: 'mesa', title: 'Mesa do Dragão' },
  }) as StoredEvent;

describe('calendar invite handler', () => {
  it('does not exist until every secret it needs is configured', () => {
    expect(inviteHandler(undefined)).toBeNull();
    expect(inviteHandler({ RESEND_API_KEY: 'x' })).toBeNull();
    expect(inviteHandler(env)?.name).toBe('calendar-invites-v1');
  });

  it('uses Mailpit when the local provider URL is configured, without a Resend key', async () => {
    const sent = capture();
    const local = {
      MAILPIT_URL: 'http://127.0.0.1:54344',
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
      APP_ORIGIN: env.APP_ORIGIN,
    };

    expect(inviteHandler(local)?.name).toBe('calendar-invites-v1');

    await createInviteHandler(
      { ...local, RESEND_FROM: 'Mesa Aberta <no-reply@mesaaberta.local>' },
      sent.request,
      admin(),
    ).handle(event('PlayerJoined'), test.db);

    expect(sent.urls[0]).toBe('http://127.0.0.1:54344/api/v1/send');
    expect(sent.bodies[0]).toMatchObject({
      To: [{ Email: 'ana@example.com' }],
      Subject: 'Convite: Mesa do Dragão',
    });
  });

  it('takes the admin key under either name, so the legacy service_role key keeps working', () => {
    const { SUPABASE_SECRET_KEY, ...rest } = env;

    expect(inviteHandler({ ...rest, SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SECRET_KEY })?.name).toBe(
      'calendar-invites-v1',
    );
    expect(inviteHandler(rest)).toBeNull();
  });

  it('sends a private REQUEST attachment for a confirmed player', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const client = admin();
    await createInviteHandler(env, request, client).handle(event('PlayerJoined'), test.db);

    expect(client.auth.admin.getUserById).toHaveBeenCalledWith(player);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init?.headers).toMatchObject({
      'Idempotency-Key': `${event('PlayerJoined').id}:${player}:REQUEST`,
    });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({
      to: ['ana@example.com'],
      subject: 'Convite: Mesa do Dragão',
      text: expect.stringContaining('vaga confirmada'),
    });
    expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
      'METHOD:REQUEST',
    );
    expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
      'ATTENDEE;CN=Ana',
    );
  });

  it('names the attendee by their username when they gave no name', async () => {
    const sent: RequestInit[] = [];
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) sent.push(init);
      return new Response('{}', { status: 200 });
    });
    await test.db.update(profiles).set({ name: null }).where(eq(profiles.id, player));

    try {
      await createInviteHandler(env, request as unknown as typeof fetch, admin()).handle(
        event('PlayerJoined'),
        test.db,
      );

      const { attachments } = JSON.parse(String(sent[0]?.body));
      expect(Buffer.from(attachments[0].content, 'base64').toString()).toContain(
        'ATTENDEE;CN=ana-souza',
      );
    } finally {
      await test.db.update(profiles).set({ name: 'Ana' }).where(eq(profiles.id, player));
    }
  });

  it('sends a CANCEL attachment to the player after they leave', async () => {
    const sentRequests: RequestInit[] = [];
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) sentRequests.push(init);
      return new Response('{}', { status: 200 });
    });

    await createInviteHandler(env, request as unknown as typeof fetch, admin()).handle(
      event('PlayerLeft'),
      test.db,
    );

    const sent = JSON.parse(String(sentRequests[0]?.body));
    expect(sent.subject).toBe('Cancelada: Mesa do Dragão');
    expect(sent.attachments[0].content_type).toContain('method=CANCEL');
    expect(Buffer.from(sent.attachments[0].content, 'base64').toString()).toContain(
      'METHOD:CANCEL',
    );
  });

  it('sends the inline copy for the two plain notifications when no template is configured', async () => {
    const sent = capture();

    await createInviteHandler(env, sent.request, admin('mestre@example.com')).handle(
      event('JoinRequested'),
      test.db,
    );
    await createInviteHandler(env, sent.request, admin('ana@example.com')).handle(
      event('JoinDeclined'),
      test.db,
    );

    expect(sent.bodies[0]).toMatchObject({
      to: ['mestre@example.com'],
      subject: 'Nova solicitação: Mesa do Dragão',
      text: 'Há uma nova solicitação para a mesa "Mesa do Dragão".',
    });
    expect(sent.bodies[1]).toMatchObject({
      to: ['ana@example.com'],
      subject: 'Solicitação recusada: Mesa do Dragão',
      text: 'Sua solicitação para a mesa "Mesa do Dragão" foi recusada.',
    });
    expect(sent.bodies[0]).not.toHaveProperty('template');
    expect(sent.bodies[1]).not.toHaveProperty('template');
    expect(sent.headers[0]).toMatchObject({
      'Idempotency-Key': `${event('JoinRequested').id}:${gm}:notification`,
    });
  });

  it("adds the player's introduction to the inline request e-mail, for the GM only", async () => {
    await test.db
      .insert(registrations)
      .values({ tableId, playerId: player, status: 'pending', message: 'Oi, mestre!' });
    const sent = capture();

    await createInviteHandler(env, sent.request, admin('mestre@example.com')).handle(
      event('JoinRequested'),
      test.db,
    );
    await createInviteHandler(env, sent.request, admin('ana@example.com')).handle(
      event('JoinDeclined'),
      test.db,
    );

    expect(sent.bodies[0].text).toBe(
      'Há uma nova solicitação para a mesa "Mesa do Dragão".\n\nMensagem de @ana-souza:\nOi, mestre!',
    );
    expect(sent.bodies[1].text).toBe('Sua solicitação para a mesa "Mesa do Dragão" foi recusada.');
  });

  it('invites only the GM when a table is created', async () => {
    const sent = capture();

    await createInviteHandler(env, sent.request, admin('mestre@example.com')).handle(
      tableEvent('TableCreated'),
      test.db,
    );

    expect(sent.bodies).toHaveLength(1);
    expect(sent.bodies[0]).toMatchObject({
      to: ['mestre@example.com'],
      subject: 'Convite: Mesa do Dragão',
    });
  });

  it('invites the approved player, not the GM', async () => {
    const sent = capture();

    await createInviteHandler(env, sent.request, admin()).handle(event('JoinApproved'), test.db);

    expect(sent.bodies).toHaveLength(1);
    expect(sent.bodies[0]).toMatchObject({
      to: ['ana@example.com'],
      subject: 'Convite: Mesa do Dragão',
    });
  });

  it('sends an updated invite to the GM and every confirmed player when the table changes', async () => {
    await test.db.insert(registrations).values({ tableId, playerId: player, status: 'confirmed' });
    const byId = adminByRecipient({ [gm]: 'mestre@example.com', [player]: 'ana@example.com' });
    const sent = capture();

    await createInviteHandler(env, sent.request, byId).handle(tableEvent('TableUpdated'), test.db);

    expect(sent.bodies.map((body) => body.to[0]).sort()).toEqual([
      'ana@example.com',
      'mestre@example.com',
    ]);
    for (const body of sent.bodies) expect(body.subject).toBe('Convite: Mesa do Dragão');
  });

  it('cancels for the GM and every confirmed player when the table is disabled', async () => {
    await test.db.insert(registrations).values({ tableId, playerId: player, status: 'confirmed' });
    const byId = adminByRecipient({ [gm]: 'mestre@example.com', [player]: 'ana@example.com' });
    const sent = capture();

    await createInviteHandler(env, sent.request, byId).handle(tableEvent('TableDisabled'), test.db);

    expect(sent.bodies.map((body) => body.to[0]).sort()).toEqual([
      'ana@example.com',
      'mestre@example.com',
    ]);
    for (const body of sent.bodies) expect(body.subject).toBe('Cancelada: Mesa do Dragão');
  });

  describe('with hosted Resend templates', () => {
    const templated = {
      ...env,
      RESEND_TEMPLATE_INVITE: 'tpl-invite',
      RESEND_TEMPLATE_CANCEL: 'tpl-cancel',
      RESEND_TEMPLATE_JOIN_REQUESTED: 'tpl-requested',
      RESEND_TEMPLATE_JOIN_DECLINED: 'tpl-declined',
    };
    const startsAt = formatSession(new Date('2026-10-10T22:00:00Z'), 'America/Sao_Paulo', 'pt-BR');

    it('sends the invite template with the .ics attachment and the idempotency key', async () => {
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin()).handle(
        event('PlayerJoined'),
        test.db,
      );

      expect(sent.bodies).toHaveLength(1);
      const [body] = sent.bodies;
      expect(body.template).toEqual({
        id: 'tpl-invite',
        variables: {
          RECIPIENT_NAME: 'Ana',
          TABLE_TITLE: 'Mesa do Dragão',
          TABLE_URL: 'https://mesaaberta.app/tables/mesa',
          CONTEXT: 'REQUEST',
          STARTS_AT: startsAt,
          FALLBACK_TEXT: expect.stringContaining('vaga confirmada'),
        },
      });
      expect(body).not.toHaveProperty('text');
      expect(body).not.toHaveProperty('html');
      expect(body.subject).toBe('Convite: Mesa do Dragão');
      expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
        'METHOD:REQUEST',
      );
      expect(sent.headers[0]).toMatchObject({
        'Idempotency-Key': `${event('PlayerJoined').id}:${player}:REQUEST`,
      });
    });

    it("writes the time in the recipient's own timezone when they have one", async () => {
      await test.db
        .update(profiles)
        .set({ timezone: 'Europe/Lisbon' })
        .where(eq(profiles.id, player));
      try {
        const sent = capture();

        await createInviteHandler(templated, sent.request, admin()).handle(
          event('PlayerJoined'),
          test.db,
        );

        const lisbon = formatSession(new Date('2026-10-10T22:00:00Z'), 'Europe/Lisbon', 'pt-BR');
        expect(lisbon).not.toBe(startsAt);
        expect(sent.bodies[0].template.variables.STARTS_AT).toBe(lisbon);
      } finally {
        await test.db.update(profiles).set({ timezone: null }).where(eq(profiles.id, player));
      }
    });

    it('sends the cancel template with a CANCEL attachment', async () => {
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin()).handle(
        event('PlayerLeft'),
        test.db,
      );

      const [body] = sent.bodies;
      expect(body.template.id).toBe('tpl-cancel');
      expect(body.template.variables.CONTEXT).toBe('CANCEL');
      expect(body.template.variables.FALLBACK_TEXT).toContain('cancelada');
      expect(Buffer.from(body.attachments[0].content, 'base64').toString()).toContain(
        'METHOD:CANCEL',
      );
      expect(sent.headers[0]).toMatchObject({
        'Idempotency-Key': `${event('PlayerLeft').id}:${player}:CANCEL`,
      });
    });

    it('sends the join-requested template to the GM, without an attachment', async () => {
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin('mestre@example.com')).handle(
        event('JoinRequested'),
        test.db,
      );

      const [body] = sent.bodies;
      expect(body.to).toEqual(['mestre@example.com']);
      expect(body.template.id).toBe('tpl-requested');
      expect(body.template.variables).toMatchObject({
        RECIPIENT_NAME: 'mestre',
        CONTEXT: 'JOIN_REQUESTED',
        FALLBACK_TEXT: 'Há uma nova solicitação para a mesa "Mesa do Dragão".',
      });
      expect(body).not.toHaveProperty('attachments');
      expect(sent.headers[0]).toMatchObject({
        'Idempotency-Key': `${event('JoinRequested').id}:${gm}:notification`,
      });
    });

    it("puts the player's introduction in the join-requested template, as a section of its own", async () => {
      await test.db.insert(registrations).values({
        tableId,
        playerId: player,
        status: 'pending',
        message: 'Oi <b>mestre</b>!\n\nJogo há 2 anos.',
      });
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin('mestre@example.com')).handle(
        event('JoinRequested'),
        test.db,
      );

      const { variables } = sent.bodies[0].template;
      expect(variables.PLAYER_MESSAGE).toBe(
        '<h3>Mensagem de @ana-souza</h3><p>Oi &lt;b&gt;mestre&lt;/b&gt;!</p><p>Jogo há 2 anos.</p>',
      );
      // The plain-text copy goes through the same angle-bracket removal as every other variable.
      expect(variables.FALLBACK_TEXT).toContain('Mensagem de @ana-souza:\nOi bmestre/b!');
    });

    it('leaves PLAYER_MESSAGE out when the player wrote nothing', async () => {
      await test.db
        .insert(registrations)
        .values({ tableId, playerId: player, status: 'pending', message: null });
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin('mestre@example.com')).handle(
        event('JoinRequested'),
        test.db,
      );

      expect(sent.bodies[0].template.variables).not.toHaveProperty('PLAYER_MESSAGE');
    });

    it('sends the join-declined template to the player, without an attachment', async () => {
      const sent = capture();

      await createInviteHandler(templated, sent.request, admin()).handle(
        event('JoinDeclined'),
        test.db,
      );

      const [body] = sent.bodies;
      expect(body.template.id).toBe('tpl-declined');
      expect(body.template.variables).toMatchObject({
        RECIPIENT_NAME: 'Ana',
        CONTEXT: 'JOIN_DECLINED',
      });
      expect(body).not.toHaveProperty('attachments');
      expect(sent.headers[0]).toMatchObject({
        'Idempotency-Key': `${event('JoinDeclined').id}:${player}:notification`,
      });
    });

    it('falls back to the inline copy for a template that is not configured, and templates the rest', async () => {
      const sent = capture();
      const onlyInvite = { ...env, RESEND_TEMPLATE_INVITE: 'tpl-invite' };

      await createInviteHandler(onlyInvite, sent.request, admin()).handle(
        event('PlayerLeft'),
        test.db,
      );
      await createInviteHandler(onlyInvite, sent.request, admin()).handle(
        event('PlayerJoined'),
        test.db,
      );

      expect(sent.bodies[0]).not.toHaveProperty('template');
      expect(sent.bodies[0].text).toContain('foi cancelada');
      expect(sent.bodies[1].template.id).toBe('tpl-invite');
    });

    it('sends only the allowlisted variables, never an id, address, token or secret', async () => {
      const sent = capture();

      for (const type of ['PlayerJoined', 'PlayerLeft', 'JoinRequested', 'JoinDeclined'] as const) {
        await createInviteHandler(templated, sent.request, admin()).handle(event(type), test.db);
      }

      expect(sent.bodies).toHaveLength(4);
      for (const body of sent.bodies) {
        expect(Object.keys(body.template.variables).sort()).toEqual(
          [...TEMPLATE_VARIABLES]
            .filter((name) => name !== 'WELCOME_MESSAGE' && name !== 'PLAYER_MESSAGE')
            .sort(),
        );
        const variables = JSON.stringify(body.template.variables);
        for (const forbidden of [
          event('PlayerJoined').id,
          player,
          gm,
          tableId,
          'ana@example.com',
          're_test',
          'sb_secret_test',
        ]) {
          expect(variables).not.toContain(forbidden);
        }
      }
    });

    it('throws when Resend refuses a templated send, so the sweeper retries', async () => {
      const sent = capture(422);

      await expect(
        createInviteHandler(templated, sent.request, admin()).handle(
          event('PlayerJoined'),
          test.db,
        ),
      ).rejects.toThrow('Resend request failed (422)');
    });

    it('takes the template ids through inviteHandler from the Worker environment', () => {
      expect(inviteHandler({ ...templated })?.name).toBe('calendar-invites-v1');
    });
  });
});

/** What the tests read back from a Resend request body. */
type SentBody = {
  to: string[];
  To?: Array<{ Email: string; Name?: string }>;
  subject: string;
  Subject?: string;
  text?: string;
  html?: string;
  template: { id: string; variables: Record<string, string> };
  attachments: Array<{ filename: string; content: string }>;
};

/** Records what would reach Resend; the real API is never called. */
function capture(status = 200) {
  const bodies: SentBody[] = [];
  const headers: Array<Record<string, string>> = [];
  const urls: string[] = [];
  const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    bodies.push(JSON.parse(String(init?.body)));
    headers.push(init?.headers as Record<string, string>);
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  return { request, bodies, headers, urls };
}
describe('the GM welcome message in the invite', () => {
  const templated = {
    ...env,
    RESEND_TEMPLATE_INVITE: 'tpl-invite',
    RESEND_TEMPLATE_CANCEL: 'tpl-cancel',
    RESEND_TEMPLATE_JOIN_REQUESTED: 'tpl-requested',
    RESEND_TEMPLATE_JOIN_DECLINED: 'tpl-declined',
  };

  const sentBodies = async (
    type: StoredEvent['type'],
    welcomeMessage: string | null,
    config: typeof env = env,
  ) => {
    await test.db.update(gameTables).set({ welcomeMessage }).where(eq(gameTables.id, tableId));
    const sent = capture();
    await createInviteHandler(config, sent.request, admin()).handle(event(type), test.db);
    return sent.bodies;
  };

  it.each(['JoinApproved', 'PlayerJoined'] as const)(
    'is in the inline %s e-mail, with the table title in place of the token',
    async (type) => {
      const [body] = await sentBodies(
        type,
        `<p>Bem-vinda à ${TITLE_TOKEN}! <strong>WhatsApp</strong>: (11) 99999-0000</p>`,
      );

      expect(body.text).toContain(
        'Mensagem da mesa:\nBem-vinda à Mesa do Dragão! WhatsApp: (11) 99999-0000',
      );
      expect(body.html).toContain(
        '<h3>Mensagem da mesa</h3><p>Bem-vinda à Mesa do Dragão! <strong>WhatsApp</strong>',
      );
    },
  );

  it.each(['JoinApproved', 'PlayerJoined'] as const)(
    'is the WELCOME_MESSAGE variable of the hosted %s template',
    async (type) => {
      const [body] = await sentBodies(type, `<p>Bem-vinda à ${TITLE_TOKEN}!</p>`, templated);

      expect(body.template.id).toBe('tpl-invite');
      expect(body.template.variables.WELCOME_MESSAGE).toBe(
        '<h3>Mensagem da mesa</h3><p>Bem-vinda à Mesa do Dragão!</p>',
      );
      expect(Object.keys(body.template.variables).sort()).toEqual(
        [...TEMPLATE_VARIABLES].filter((name) => name !== 'PLAYER_MESSAGE').sort(),
      );
    },
  );

  it('escapes the message in the inline HTML and does not turn it into markup', async () => {
    const [body] = await sentBodies('PlayerJoined', '<img src=x onerror=alert(1)> & "oi"');

    expect(body.html).not.toContain('<img');
    expect(body.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;oi&quot;');
  });

  it.each([null, '', '  \n '])(
    'leaves no "Mensagem da mesa" section when the message is %j',
    async (message) => {
      const [inline] = await sentBodies('PlayerJoined', message);
      const [hosted] = await sentBodies('PlayerJoined', message, templated);

      expect(inline.text).not.toContain('Mensagem da mesa');
      expect(inline.html).not.toContain('Mensagem da mesa');
      expect(inline.text).toBe(inline.text?.trimEnd());
      expect(inline.text).toContain('vaga confirmada');
      expect(hosted.template.variables).not.toHaveProperty('WELCOME_MESSAGE');
    },
  );

  it('is not added to updates, cancellations or the GM notifications, inline or hosted', async () => {
    for (const config of [env, templated]) {
      for (const type of ['TableUpdated', 'PlayerLeft', 'JoinRequested', 'JoinDeclined'] as const) {
        const bodies = await sentBodies(type, 'Segredo do mestre', config);
        expect(bodies.length).toBeGreaterThan(0);
        for (const body of bodies) {
          expect(JSON.stringify(body)).not.toContain('Segredo do mestre');
        }
      }
    }
  });
});
