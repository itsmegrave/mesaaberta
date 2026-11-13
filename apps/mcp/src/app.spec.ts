import { describe, expect, it, beforeAll } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createFlags } from '@mesaaberta/core/server/flags/flags';
import type { FlagName } from '@mesaaberta/core/server/flags/registry';
import { createMcp, type McpEnv } from './app';
import { DESTRUCTIVE_TOOL_NAMES, TOOL_NAMES, WRITE_TOOL_NAMES } from './tools';

const SUPABASE = 'https://project.supabase.co';
const ISSUER = `${SUPABASE}/auth/v1`;
const USER = '00000000-0000-4000-8000-0000000000aa';
const CLIENT = '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d';

let privateKey: CryptoKey;
let publicJwk: JWK;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' };
  otherKey = (await generateKeyPair('ES256')).privateKey;
});

type Claims = Record<string, unknown>;
const tokenFor = (claims: Claims = {}, key = privateKey) =>
  new SignJWT({ role: 'authenticated', client_id: CLIENT, ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer((claims.iss as string) ?? ISSUER)
    .setAudience((claims.aud as string) ?? 'authenticated')
    .setSubject((claims.sub as string) ?? USER)
    .setIssuedAt()
    .setExpirationTime((claims.exp as number) ?? '1h')
    .sign(key);

type Seen = { path: string; actor: string | null; method: string; body: unknown };
/** A stand-in for the api Worker's binding: answers by path and records who asked for what. */
function fakeApi(
  answers: Record<string, { status?: number; body: unknown }> = {},
  profile: unknown = { id: USER, username: 'grave', status: 'active', role: 'admin' },
) {
  const seen: Seen[] = [];
  const binding = {
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      const path = url.pathname + url.search;
      const body: unknown = request.method === 'GET' ? null : await request.json();
      seen.push({ path, actor: request.headers.get('x-actor-id'), method: request.method, body });
      if (url.pathname === '/v1/me') return Response.json({ profile });
      const answer = answers[path] ?? answers[url.pathname];
      if (!answer) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json(answer.body, { status: answer.status ?? 200 });
    },
  };
  return { binding, seen };
}

const flagsWith = (on: FlagName[]) => () =>
  createFlags(async () => null, {
    overrides: Object.fromEntries(on.map((name) => [name, true])) as Partial<
      Record<FlagName, boolean>
    >,
  });

function setUp({
  on = ['use_mcp'] as FlagName[],
  answers = {} as Record<string, { status?: number; body: unknown }>,
  profile = undefined as unknown,
  env = {} as Partial<McpEnv>,
} = {}) {
  const api = profile === undefined ? fakeApi(answers) : fakeApi(answers, profile);
  const app = createMcp({
    keys: () => createLocalJWKSet({ keys: [publicJwk] }),
    flags: flagsWith(on),
  });
  const fullEnv: McpEnv = { SUPABASE_URL: SUPABASE, API: api.binding, ...env };
  const send = (body: unknown, headers: Record<string, string> = {}) =>
    app.request(
      'https://mcp.example.test/mcp',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
          ...headers,
        },
        body: JSON.stringify(body),
      },
      fullEnv,
    );
  const rpc = async (method: string, params: unknown = {}, token?: string) =>
    send(
      { jsonrpc: '2.0', id: 1, method, params },
      { authorization: `Bearer ${token ?? (await tokenFor())}` },
    );
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const response = await rpc('tools/call', { name, arguments: args });
    const { result } = (await response.json()) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    const text = result.content[0].text;
    // The SDK words its own refusals (a bad argument) as text; the tools answer JSON.
    const body: unknown = text.startsWith('{') ? JSON.parse(text) : text;
    return { isError: result.isError ?? false, body };
  };
  return { app, env: fullEnv, send, rpc, call, seen: api.seen };
}

describe('the MCP door', () => {
  it('tells a client without a token where to sign in (so it can start OAuth)', async () => {
    const { send } = setUp();
    const response = await send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://mcp.example.test/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it('names Supabase Auth as the authorization server for this resource', async () => {
    const { app, env } = setUp({ env: { MCP_URL: 'https://mcp.mesaaberta.app/mcp' } });
    const response = await app.request('/.well-known/oauth-protected-resource/mcp', {}, env);
    expect(await response.json()).toMatchObject({
      resource: 'https://mcp.mesaaberta.app/mcp',
      authorization_servers: [ISSUER],
    });
  });

  it.each([
    ['signed by a key that is not the project’s', async () => tokenFor({}, otherKey)],
    ['from another issuer', async () => tokenFor({ iss: 'https://evil.example/auth/v1' })],
    ['for another audience', async () => tokenFor({ aud: 'anon' })],
    ['expired', async () => tokenFor({ exp: Math.floor(Date.now() / 1000) - 60 })],
    // A site session token: valid, but the person never approved an MCP client.
    ['without a client_id (a site session)', async () => tokenFor({ client_id: undefined })],
    ['whose subject is not an account id', async () => tokenFor({ sub: 'service_role' })],
  ])('refuses a token %s', async (_, make) => {
    const { rpc, seen } = setUp();
    const response = await rpc('tools/list', {}, await make());
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
    expect(seen).toHaveLength(0);
  });

  it('stays shut while use_mcp is off, even for an admin with a valid token', async () => {
    const { rpc, seen } = setUp({ on: [] });
    expect((await rpc('tools/list')).status).toBe(403);
    // Only the account check ran.
    expect(seen.every((request) => request.path === '/v1/me')).toBe(true);
  });

  it.each([
    ['has not finished signing up', { id: USER, username: null, status: 'active', role: 'admin' }],
    ['is suspended', { id: USER, username: 'grave', status: 'suspended', role: 'admin' }],
    ['has no profile', null],
    // Admins only is a requirement: use_mcp being on does not open it to anyone else.
    ['is not an admin', { id: USER, username: 'ana', status: 'active', role: 'member' }],
  ])('refuses an account that %s', async (_, profile) => {
    const { rpc } = setUp({ profile });
    expect((await rpc('tools/list')).status).toBe(403);
  });

  it('answers 405 to the stream and session methods it does not keep', async () => {
    const { app, env } = setUp();
    expect((await app.request('/mcp', { method: 'GET' }, env)).status).toBe(405);
  });
});

describe('the read tools', () => {
  it('marks every tool read-only except the few that add something', async () => {
    const { rpc } = setUp();
    const response = await rpc('tools/list');
    const { result } = (await response.json()) as {
      result: {
        tools: {
          name: string;
          annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
        }[];
      };
    };
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
    const writes = new Set<string>(WRITE_TOOL_NAMES);
    for (const tool of result.tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(!writes.has(tool.name));
      if (writes.has(tool.name))
        expect(tool.annotations?.destructiveHint, tool.name).toBe(
          (DESTRUCTIVE_TOOL_NAMES as readonly string[]).includes(tool.name),
        );
    }
  });

  it('calls the api as the person the token names, never as someone an argument names', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/reads/tables': {
          body: { tables: [{ slug: 'torre' }], systems: [{ slug: 'dnd-5e' }], catalog: {} },
        },
      },
    });
    const { isError, body } = await call('search_tables', {
      system: ['dnd-5e', 'tormenta20'],
      modality: 'online',
    });
    expect(isError).toBe(false);
    // Only the tables: the page's filter menus (every system on the site) stay out.
    expect(body).toEqual({ tables: [{ slug: 'torre' }] });
    const last = seen.at(-1)!;
    expect(last.path).toBe('/v1/reads/tables?system=dnd-5e&system=tormenta20&modality=online');
    expect(seen.every((request) => request.actor === USER)).toBe(true);
  });

  it('writes the first page as no parameter and later pages as ?page=N', async () => {
    const { call, seen } = setUp({ answers: { '/v1/reads/dashboard': { body: {} } } });
    await call('my_tables', { page: 1 });
    expect(seen.at(-1)!.path).toBe('/v1/reads/dashboard');
    await call('my_tables', { page: 3 });
    expect(seen.at(-1)!.path).toBe('/v1/reads/dashboard?page=3');
  });

  it('turns an api refusal into a code, not the api’s text', async () => {
    const { call } = setUp();
    expect(await call('get_table', { slug: 'nao-existe' })).toEqual({
      isError: true,
      body: { error: 'not_found' },
    });
  });

  it('keeps a directory shut while its flag is off, without calling the api', async () => {
    const { call, seen } = setUp({ answers: { '/v1/reads/places': { body: { places: [] } } } });
    expect(await call('list_places')).toEqual({ isError: true, body: { error: 'not_found' } });
    expect(seen.some((request) => request.path.startsWith('/v1/reads/places'))).toBe(false);
  });

  it('reads a directory once its flag is on', async () => {
    const { call, seen } = setUp({
      on: ['use_mcp', 'api_directory_places'],
      answers: { '/v1/reads/places': { body: { places: [] } } },
    });
    expect((await call('list_places', { state: 'PE', partner: true })).isError).toBe(false);
    expect(seen.at(-1)!.path).toBe('/v1/reads/places?state=pe&partner=1');
  });

  it("leaves the profile page's own plumbing (flag subject, follow counts) out", async () => {
    const { call } = setUp({
      answers: {
        '/v1/profiles/grave': {
          body: {
            profile: { username: 'grave' },
            subject: { id: USER },
            follows: { followers: 3 },
          },
        },
      },
    });
    expect((await call('get_profile', { username: '@Grave' })).body).toEqual({
      profile: { username: 'grave' },
    });
  });

  it('refuses an argument outside its schema before reaching the api', async () => {
    const { call, seen } = setUp();
    const before = seen.length;
    const { isError } = await call('get_table', { slug: '../admin' });
    expect(isError).toBe(true);
    // Only the account check ran; no read was sent for the bad slug.
    expect(seen.slice(before).every((request) => request.path === '/v1/me')).toBe(true);
  });
});

describe('add_tool', () => {
  const ID = '00000000-0000-4000-8000-000000000001';
  const breu = {
    name: 'Breu: gerador de atributos',
    siteUrl: 'https://gerador-breu.mesaaberta.app',
    kinds: ['helper'],
    description: 'Rola os seis atributos de um personagem de Breu.',
  };

  it('suggests the tool as the caller, then approves it so it is listed', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/submissions/tools': { body: { eventIds: ['e1'], id: ID } },
        '/v1/admin/moderation/tool.approve': { body: { eventIds: ['e2'] } },
      },
    });
    expect(await call('add_tool', breu)).toEqual({
      isError: false,
      body: { id: ID, listed: true },
    });
    const writes = seen.filter((request) => request.method === 'POST');
    expect(writes).toEqual([
      {
        path: '/v1/submissions/tools',
        actor: USER,
        method: 'POST',
        body: { input: breu, logoPath: null },
      },
      { path: '/v1/admin/moderation/tool.approve', actor: USER, method: 'POST', body: { id: ID } },
    ]);
  });

  it('passes on the field and code of a refused suggestion (a site already listed)', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/submissions/tools': {
          status: 400,
          body: { error: 'invalid', field: 'siteUrl', message: 'duplicate' },
        },
      },
    });
    expect(await call('add_tool', breu)).toEqual({
      isError: true,
      body: { error: 'invalid', field: 'siteUrl', code: 'duplicate' },
    });
    expect(seen.some((request) => request.path.includes('tool.approve'))).toBe(false);
  });

  it('says the tool waits for approval when approving it fails', async () => {
    const { call } = setUp({
      answers: {
        '/v1/submissions/tools': { body: { eventIds: ['e1'], id: ID } },
        '/v1/admin/moderation/tool.approve': { status: 403, body: { error: 'forbidden' } },
      },
    });
    expect(await call('add_tool', breu)).toEqual({
      isError: true,
      body: { error: 'forbidden', id: ID, pending: true },
    });
  });

  it('refuses a kind the page does not group, or none, before reaching the api', async () => {
    const { call, seen } = setUp();
    const before = seen.length;
    expect((await call('add_tool', { ...breu, kinds: ['helper', 'game'] })).isError).toBe(true);
    expect((await call('add_tool', { ...breu, kinds: [] })).isError).toBe(true);
    expect(seen.slice(before).every((request) => request.method === 'GET')).toBe(true);
  });
});

describe('send_announcement', () => {
  const news = {
    title: 'Ligue o Overdrive',
    body: 'Tem tema novo!\n\nPise no pedal <Overdrive>.',
    link: '/changelog',
  };
  const sent = {
    title: news.title,
    body: '<p>Tem tema novo!</p><p>Pise no pedal &lt;Overdrive&gt;.</p>',
    link: '/changelog',
    tone: 'info',
    icon: '',
    audience: 'all_active_users',
    recipient: '',
  };

  it('only counts the audience until it is confirmed', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/admin/announcements': { body: { step: 'confirm', count: 42, recipient: null } },
      },
    });
    expect(await call('send_announcement', news)).toEqual({
      isError: false,
      body: { step: 'confirm', count: 42, recipient: null },
    });
    expect(seen.filter((request) => request.method === 'POST')).toEqual([
      {
        path: '/v1/admin/announcements',
        actor: USER,
        method: 'POST',
        body: { ...sent, confirmed: false },
      },
    ]);
  });

  it('sends when confirmed and leaves the event ids to the sweep', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/admin/announcements': { body: { step: 'sent', count: 42, eventIds: ['e1'] } },
      },
    });
    expect(await call('send_announcement', { ...news, confirmed: true })).toEqual({
      isError: false,
      body: { step: 'sent', count: 42 },
    });
    expect(seen.find((request) => request.method === 'POST')?.body).toEqual({
      ...sent,
      confirmed: true,
    });
  });

  it('passes on a refusal and refuses a link off the site before reaching the api', async () => {
    const { call, seen } = setUp({
      answers: { '/v1/admin/announcements': { status: 403, body: { error: 'forbidden' } } },
    });
    expect(await call('send_announcement', news)).toEqual({
      isError: true,
      body: { error: 'forbidden' },
    });
    const before = seen.length;
    expect(
      (await call('send_announcement', { ...news, link: 'https://example.com' })).isError,
    ).toBe(true);
    expect(seen.slice(before).every((request) => request.method === 'GET')).toBe(true);
  });
});

describe('polls', () => {
  const PERSON = '00000000-0000-4000-8000-0000000000bb';
  const poll = {
    question: 'Curtiu o tema Overdrive?',
    options: ['Amei', 'Achei ok', 'Não curti'],
    people: ['grave', PERSON],
  };

  it('only counts the reach until it is confirmed', async () => {
    const { call, seen } = setUp({
      answers: { '/v1/admin/widgets/reach': { body: { eventIds: [], reach: 2 } } },
    });
    expect(await call('create_poll', { ...poll, include: ['player'] })).toEqual({
      isError: false,
      body: { step: 'confirm', reach: 2 },
    });
    expect(seen.filter((request) => request.method === 'POST')).toEqual([
      {
        path: '/v1/admin/widgets/reach',
        actor: USER,
        method: 'POST',
        body: { 'include:player': 'on', people: `grave\n${PERSON}` },
      },
    ]);
  });

  it('creates and publishes when confirmed, placed everywhere by default', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/admin/widgets/create': { body: { eventIds: [], created: 'w1' } },
        '/v1/admin/widgets/publish': { body: { eventIds: [], published: 'w1', reach: 2 } },
      },
    });
    expect(await call('create_poll', { ...poll, confirmed: true })).toEqual({
      isError: false,
      body: { step: 'published', id: 'w1', reach: 2 },
    });
    const posts = seen.filter((request) => request.method === 'POST');
    expect(posts.map((request) => request.path)).toEqual([
      '/v1/admin/widgets/create',
      '/v1/admin/widgets/publish',
    ]);
    expect(posts[0].body).toEqual({
      title: poll.question,
      question: poll.question,
      description: '',
      choice: 'single',
      maxChoices: '',
      results: 'admin',
      options: 'Amei\nAchei ok\nNão curti',
      priority: '0',
      'placement:everywhere': 'on',
      people: `grave\n${PERSON}`,
    });
    expect(posts[1].body).toEqual({ id: 'w1' });
  });

  it('says a poll that could not be published waits as a draft', async () => {
    const { call } = setUp({
      answers: {
        '/v1/admin/widgets/create': { body: { eventIds: [], created: 'w1' } },
        '/v1/admin/widgets/publish': { body: { eventIds: [], refused: 'placement' } },
      },
    });
    expect(await call('create_poll', { ...poll, confirmed: true })).toEqual({
      isError: true,
      body: { id: 'w1', pending: true, error: 'placement' },
    });
  });

  it('names the people who match nobody, at either step', async () => {
    const refusedPeople = { eventIds: [], refused: 'people', unknown: ['grave'] };
    const { call } = setUp({
      answers: {
        '/v1/admin/widgets/reach': { body: refusedPeople },
        '/v1/admin/widgets/create': { body: refusedPeople },
      },
    });
    const unknown = {
      isError: true,
      body: { error: 'invalid', field: 'people', code: 'unknown', unknown: ['grave'] },
    };
    expect(await call('create_poll', poll)).toEqual(unknown);
    expect(await call('create_poll', { ...poll, confirmed: true })).toEqual(unknown);
  });

  it('lists polls with a count of the people picked by hand, not who they are', async () => {
    const { call } = setUp({
      answers: {
        '/v1/admin/widgets/panel': {
          body: {
            panel: {
              polls: [
                {
                  id: 'w1',
                  title: 'Overdrive',
                  status: 'live',
                  question: poll.question,
                  choice: 'single',
                  results: 'admin',
                  placements: ['everywhere'],
                  audience: { include: [], exclude: [], people: [USER, PERSON] },
                  reach: 2,
                  publishedReach: 2,
                  publishedAt: '2026-11-13T12:00:00.000Z',
                  voters: 1,
                  dismissals: 0,
                  options: [{ id: 'o1', label: 'Amei', hidden: false, votes: 1 }],
                  priority: 0,
                },
              ],
            },
          },
        },
      },
    });
    const { body } = await call('list_polls', {});
    expect(body).toEqual({
      polls: [
        expect.objectContaining({
          id: 'w1',
          audience: { include: [], exclude: [], people: 2 },
          voters: 1,
          options: [{ id: 'o1', label: 'Amei', hidden: false, votes: 1 }],
        }),
      ],
    });
  });

  it('closes a poll and says when its state refuses it', async () => {
    const id = '00000000-0000-4000-8000-0000000000cc';
    const closing = setUp({
      answers: { '/v1/admin/widgets/close': { body: { eventIds: [], moved: 'closed' } } },
    });
    expect(await closing.call('close_poll', { id })).toEqual({
      isError: false,
      body: { id, status: 'closed' },
    });
    const refusing = setUp({
      answers: { '/v1/admin/widgets/close': { body: { eventIds: [], refused: 'state' } } },
    });
    expect(await refusing.call('close_poll', { id })).toEqual({
      isError: true,
      body: { error: 'refused', reason: 'state' },
    });
  });
});

describe('post_on_social', () => {
  const reel = {
    caption: 'Procurando gente pra jogar?',
    media_url: 'https://example.com/combinar.mp4',
  };
  const sent = { caption: reel.caption, mediaUrl: reel.media_url };

  it('reads the media and asks to confirm before it posts', async () => {
    const preview = { step: 'confirm', network: 'Instagram', account: 'mesa', kind: 'video' };
    const { call, seen } = setUp({
      answers: { '/v1/admin/social/posts': { body: { eventIds: [], ...preview } } },
    });
    expect(await call('post_on_social', reel)).toEqual({ isError: false, body: preview });
    expect(seen.filter((request) => request.method === 'POST')).toEqual([
      {
        path: '/v1/admin/social/posts',
        actor: USER,
        method: 'POST',
        body: { ...sent, confirmed: false },
      },
    ]);
  });

  it('queues once confirmed, and reads where the post stands', async () => {
    const id = '00000000-0000-4000-8000-0000000000c1';
    const { call, seen } = setUp({
      answers: {
        '/v1/admin/social/posts': { body: { eventIds: [], status: 'queued', id, kind: 'video' } },
        [`/v1/admin/social/posts/${id}`]: { body: { post: { id, status: 'published' } } },
      },
    });
    expect(await call('post_on_social', { ...reel, confirmed: true })).toEqual({
      isError: false,
      body: { status: 'queued', id, kind: 'video' },
    });
    expect(seen.find((request) => request.method === 'POST')?.body).toEqual({
      ...sent,
      confirmed: true,
    });
    expect(await call('get_social_post', { id })).toEqual({
      isError: false,
      body: { post: { id, status: 'published' } },
    });
  });

  it('passes on what the connector refused and refuses an http address itself', async () => {
    const { call, seen } = setUp({
      answers: {
        '/v1/admin/social/posts': {
          status: 400,
          body: { error: 'invalid', field: 'media', message: 'too_large' },
        },
      },
    });
    expect(await call('post_on_social', reel)).toEqual({
      isError: true,
      body: { error: 'invalid', field: 'media', code: 'too_large' },
    });
    const before = seen.length;
    expect(
      (await call('post_on_social', { ...reel, media_url: 'http://example.com/a.mp4' })).isError,
    ).toBe(true);
    expect(seen.slice(before).every((request) => request.method === 'GET')).toBe(true);
  });
});
