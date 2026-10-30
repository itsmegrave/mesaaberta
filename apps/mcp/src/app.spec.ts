import { describe, expect, it, beforeAll } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createFlags } from '@mesaaberta/core/server/flags/flags';
import type { FlagName } from '@mesaaberta/core/server/flags/registry';
import { createMcp, type McpEnv } from './app';
import { TOOL_NAMES } from './tools';

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

type Seen = { path: string; actor: string | null };
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
      seen.push({ path, actor: request.headers.get('x-actor-id') });
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
  it('lists only read-only tools', async () => {
    const { rpc } = setUp();
    const response = await rpc('tools/list');
    const { result } = (await response.json()) as {
      result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] };
    };
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(result.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it('calls the api as the person the token names, never as someone an argument names', async () => {
    const { call, seen } = setUp({
      answers: { '/v1/reads/tables': { body: { tables: [{ slug: 'torre' }] } } },
    });
    const { isError, body } = await call('search_tables', {
      system: ['dnd-5e', 'tormenta20'],
      modality: 'online',
    });
    expect(isError).toBe(false);
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
