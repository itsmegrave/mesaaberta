import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { JWTVerifyGetKey } from 'jose';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
import { REQUEST_ID_HEADER, requestIdFrom, withRequestId } from '@mesaaberta/contracts';
import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import type { Flags } from '@mesaaberta/core/server/flags/flags';
import { logger } from '@mesaaberta/core/server/logger';
import { apiReader, type ApiEnv } from './api';
import { bearerOf, issuerOf, supabaseKeys, verifyToken } from './auth';
import { mcpFlags, type FlagsEnv } from './flags';
import { registerTools } from './tools';

export type McpEnv = ApiEnv &
  FlagsEnv &
  BuildEnv & {
    /** The Supabase project whose OAuth 2.1 server signs people in (`https://<ref>.supabase.co`). */
    SUPABASE_URL?: string;
    /** The public address of `/mcp`, when the Worker sits behind a name it cannot see itself. */
    MCP_URL?: string;
  };

type Deps = {
  /** The project's public keys; the specs pass a local set. */
  keys?: (issuer: string) => JWTVerifyGetKey;
  flags?: (env: McpEnv | undefined) => Flags;
};

const INSTRUCTIONS =
  'Mesa Aberta (mesaaberta.app) is a Brazilian site for finding and running tabletop RPG tables ' +
  '(mesas). These tools read it as the person who connected this client: open tables, their own ' +
  'tables and calendar, the game systems, places to play (Onde jogar), game masters (Quem mestra), ' +
  'profiles, notifications and messages. The site is in Brazilian Portuguese; answer in the ' +
  "person's language. Nothing here changes anything on the site.";

/** The address of `/mcp` as clients reach it, which the protected-resource metadata names. */
const resourceOf = (c: Context<{ Bindings: McpEnv }>) =>
  c.env?.MCP_URL?.replace(/\/$/, '') || new URL('/mcp', c.req.url).toString();

const metadataUrlOf = (resource: string) => {
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
};

/**
 * The MCP server: a door to the api for Claude and other MCP clients, nothing more (no database,
 * no business rule). A client signs the person in with Supabase's OAuth 2.1 server, which sends
 * them to the consent page on the site; each request then carries that access token, checked here,
 * and the api is called as the person (`x-actor-id`) exactly as the web Worker calls it. Stateless:
 * every POST builds the server, answers and ends, so no session or store is kept.
 */
export function createMcp({ keys = supabaseKeys, flags = mcpFlags }: Deps = {}) {
  const app = new Hono<{ Bindings: McpEnv }>();

  app.use('*', async (c, next) => {
    const requestId = requestIdFrom(c.req.header(REQUEST_ID_HEADER)) ?? crypto.randomUUID();
    await withRequestId(requestId, next);
    c.header(REQUEST_ID_HEADER, requestId);
  });

  // Browser-based clients (the MCP Inspector) read these cross-origin. The token is a header, never
  // a cookie, so any origin may ask.
  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['authorization', 'content-type', 'mcp-protocol-version', 'mcp-session-id'],
      exposeHeaders: ['www-authenticate', 'mcp-session-id'],
    }),
  );

  app.get('/healthz', (c) =>
    c.json({ status: 'ok', service: 'mcp', ...buildInfoOf(c.env as BuildEnv | undefined) }),
  );

  // RFC 9728: where a client learns which authorization server signs people in. The path form
  // (`…/oauth-protected-resource/mcp`) is what the 401 points at; the bare one is for older clients.
  const metadata = (c: Context<{ Bindings: McpEnv }>) => {
    if (!c.env?.SUPABASE_URL) return c.json({ error: 'unavailable' }, 503);
    return c.json({
      resource: resourceOf(c),
      authorization_servers: [issuerOf(c.env.SUPABASE_URL)],
      bearer_methods_supported: ['header'],
      resource_name: 'Mesa Aberta',
      resource_documentation: 'https://github.com/itsmegrave/mesaaberta/tree/main/apps/mcp',
    });
  };
  app.get('/.well-known/oauth-protected-resource', metadata);
  app.get('/.well-known/oauth-protected-resource/mcp', metadata);

  // Stateless: there is no stream to open and no session to end.
  app.on(['GET', 'DELETE'], '/mcp', (c) =>
    c.json({ error: 'method_not_allowed' }, 405, { allow: 'POST' }),
  );

  app.post('/mcp', async (c) => {
    const started = Date.now();
    const env = c.env ?? {};
    if (!env.SUPABASE_URL) return c.json({ error: 'unavailable' }, 503);
    const issuer = issuerOf(env.SUPABASE_URL);
    const challenge = (error?: 'invalid_token') =>
      c.json({ error: error ?? 'unauthorized' }, 401, {
        'www-authenticate': `Bearer ${error ? `error="${error}", ` : ''}resource_metadata="${metadataUrlOf(resourceOf(c))}"`,
      });

    const token = bearerOf(c.req.header('authorization'));
    if (!token) return challenge();
    const caller = await verifyToken(token, issuer, keys(issuer));
    if (!caller) return challenge('invalid_token');
    const { userId } = caller;

    let read;
    try {
      read = apiReader(env, userId);
      // The account as the api reads it: one that has not finished signing up, or a suspended
      // one, gets nothing here, as on the site.
      const me = await read('/v1/me');
      if (me.status !== 200) return c.json({ error: 'unavailable' }, 503);
      const profile = (me.body as { profile?: (Actor & { username?: string | null }) | null })
        ?.profile;
      if (!profile?.username || profile.status !== 'active') {
        logger.info('mcp.request_refused', { code: 'profile_unusable', userId });
        return c.json({ error: 'forbidden' }, 403);
      }
      // Admins only, always: a requirement, not a rollout. `use_mcp` is only the kill switch.
      if (!can(profile, 'admin:access')) {
        logger.info('mcp.request_refused', { code: 'admin_only', userId });
        return c.json({ error: 'forbidden' }, 403);
      }
    } catch (error) {
      logger.warn('mcp.api_unreachable', { code: 'api_call_failed', userId, error });
      return c.json({ error: 'unavailable' }, 503);
    }

    const flagSet = flags(env);
    if (!(await flagSet.isEnabled('use_mcp', { id: userId, isAdmin: true }))) {
      logger.info('mcp.request_refused', { code: 'mcp_off', userId });
      return c.json({ error: 'forbidden' }, 403);
    }

    const server = new McpServer(
      { name: 'mesa-aberta', version: buildInfoOf(env).version ?? '0.0.0' },
      { instructions: INSTRUCTIONS, jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
    );
    registerTools(server, {
      read,
      isEnabled: (flag) => flagSet.isEnabled(flag, { id: userId, isAdmin: true }),
      userId,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(c.req.raw, {
      authInfo: {
        token: caller.token,
        clientId: caller.clientId,
        scopes: [],
        expiresAt: caller.expiresAt,
      },
    });
    logger.info('mcp.request_completed', {
      userId,
      status: response.status,
      durationMs: Date.now() - started,
    });
    return response;
  });

  return app;
}
