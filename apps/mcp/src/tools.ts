import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AnyFlagName } from '@mesaaberta/core/server/flags/flags';
import { logger } from '@mesaaberta/core/server/logger';
import { z } from 'zod';
import { queryOf, type ApiAnswer, type ApiReader } from './api';

/** What a tool needs: the api as the caller, and the caller's flags. */
export type ToolContext = {
  read: ApiReader;
  isEnabled: (flag: AnyFlagName) => Promise<boolean>;
  userId: string;
};

const SLUG = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const USERNAME = z.string().regex(/^@?[a-z0-9]+(?:-[a-z0-9]+)*$/i);
const PAGE = z.number().int().min(1).optional().describe('Page number, from 1.');

// Everything here only reads: no tool changes anything on the site (phase 1 of the MCP plan).
const READ = { readOnlyHint: true, openWorldHint: false } as const;

/** The refusal a tool answers, as a code the model can act on; never the api's own text. */
const refusal = (status: number) =>
  status === 404
    ? 'not_found'
    : status === 401 || status === 403
      ? 'forbidden'
      : status === 429
        ? 'rate_limited'
        : 'unavailable';

const result = (body: unknown, isError = false): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(body) }],
  ...(isError ? { isError: true } : {}),
});

/** A page past the last one, the first page written as no parameter (the site's own rule). */
const page = (n: number | undefined) => (n && n > 1 ? n : undefined);

/**
 * Registers the read tools, each a thin call to an api route the site already uses. A tool behind
 * a directory flag answers `not_found` while that directory is off for the caller, as the page
 * does. Logs carry the tool and the status, never the arguments.
 */
export function registerTools(server: McpServer, context: ToolContext) {
  const { read, isEnabled, userId } = context;

  const answer = async (
    tool: string,
    call: () => Promise<ApiAnswer>,
    shape: (body: unknown) => unknown = (body) => body,
  ) => {
    try {
      const { status, body } = await call();
      if (status >= 200 && status < 300) return result(shape(body));
      logger.info('mcp.tool_refused', { tool, status, userId });
      return result({ error: refusal(status) }, true);
    } catch (error) {
      logger.warn('mcp.tool_failed', { tool, code: 'api_call_failed', userId, error });
      return result({ error: 'unavailable' }, true);
    }
  };

  const behind = async (flag: AnyFlagName, tool: string, call: () => Promise<ApiAnswer>) =>
    (await isEnabled(flag)) ? answer(tool, call) : result({ error: 'not_found' }, true);

  server.registerTool(
    'search_tables',
    {
      title: 'Search open tables',
      description:
        'Lists the tabletop RPG tables (mesas) open on Mesa Aberta, soonest first. Filter by game ' +
        'system, online or in person, platform, tag or the GM. Slugs come from list_systems and ' +
        "from a table's own page.",
      inputSchema: {
        system: z.array(SLUG).max(10).optional().describe('Game system slugs, such as "dnd-5e".'),
        modality: z.enum(['online', 'in_person']).optional(),
        platform: z.array(SLUG).max(10).optional().describe('Platform slugs, such as "discord".'),
        tag: z.array(SLUG).max(10).optional().describe('Tag slugs.'),
        gm: USERNAME.optional().describe("Only this GM's tables, by username."),
      },
      annotations: READ,
    },
    async ({ system, modality, platform, tag, gm }) =>
      answer('search_tables', () =>
        read(`/v1/reads/tables${queryOf({ system, modality, platform, tag, gm })}`),
      ),
  );

  server.registerTool(
    'get_table',
    {
      title: 'Read a table',
      description:
        "A table's page: what it plays, when, where, the GM, seats and who has one, and whether " +
        'the caller is registered. `slug` is the last part of its address (/t/<slug>).',
      inputSchema: { slug: SLUG },
      annotations: READ,
    },
    async ({ slug }) =>
      answer('get_table', () => read(`/v1/reads/detail/${encodeURIComponent(slug)}`)),
  );

  server.registerTool(
    'my_tables',
    {
      title: 'My tables',
      description: 'The tables the caller runs or plays in (Minhas mesas), newest first.',
      inputSchema: { page: PAGE },
      annotations: READ,
    },
    async ({ page: n }) =>
      answer('my_tables', () => read(`/v1/reads/dashboard${queryOf({ page: page(n) })}`)),
  );

  server.registerTool(
    'my_calendar',
    {
      title: 'My calendar',
      description: 'The upcoming sessions of the tables the caller runs or has a seat at.',
      annotations: READ,
    },
    async () => answer('my_calendar', () => read('/v1/me/calendar')),
  );

  server.registerTool(
    'list_systems',
    {
      title: 'Game systems',
      description:
        'The game systems directory (Sistemas): each system and how many tables play it. Use a ' +
        "system's slug in search_tables.",
      inputSchema: {
        query: z.string().max(100).optional().describe('Part of the name.'),
        show: z.enum(['open', 'all']).optional().describe('Systems with open tables, or all.'),
        sort: z.enum(['open', 'played', 'az']).optional(),
        page: PAGE,
      },
      annotations: READ,
    },
    async ({ query, show, sort, page: n }) =>
      behind('api_directory_systems', 'list_systems', () =>
        read(`/v1/reads/systems${queryOf({ q: query, show, sort, page: page(n) })}`),
      ),
  );

  server.registerTool(
    'get_system',
    {
      title: 'Read a game system',
      description: "A game system's page (/s/<slug>): what it is and its open tables.",
      inputSchema: { slug: SLUG },
      annotations: READ,
    },
    async ({ slug }) =>
      behind('api_directory_systems', 'get_system', () =>
        read(`/v1/reads/systems/${encodeURIComponent(slug)}`),
      ),
  );

  server.registerTool(
    'list_places',
    {
      title: 'Places to play',
      description:
        'Onde jogar: game stores, cafés, clubs and other places to play in person in Brazil.',
      inputSchema: {
        query: z.string().max(100).optional().describe('Name, description or area.'),
        state: z
          .string()
          .regex(/^[a-z]{2}$/i)
          .optional()
          .describe('Brazilian state, such as "pe".'),
        city: SLUG.optional().describe('City tag within the state, such as "pe-recife".'),
        kind: z.enum(['store', 'game_cafe', 'club', 'bar', 'cultural_space', 'other']).optional(),
        tag: z.array(SLUG).max(10).optional().describe('Tags every place must have.'),
        partner: z.boolean().optional().describe('Only partner places.'),
        sort: z.enum(['open', 'recent', 'name']).optional(),
        page: PAGE,
      },
      annotations: READ,
    },
    async ({ query, state, city, kind, tag, partner, sort, page: n }) =>
      behind('api_directory_places', 'list_places', () =>
        read(
          `/v1/reads/places${queryOf({ q: query, state: state?.toLowerCase(), city, kind, tag, partner, sort, page: page(n) })}`,
        ),
      ),
  );

  server.registerTool(
    'get_place',
    {
      title: 'Read a place',
      description: "A place's page (/pp/<slug>): address, opening hours, tags and its tables.",
      inputSchema: { slug: SLUG },
      annotations: READ,
    },
    async ({ slug }) =>
      behind('api_directory_places', 'get_place', () =>
        read(`/v1/reads/places/${encodeURIComponent(slug)}`),
      ),
  );

  server.registerTool(
    'list_gamemasters',
    {
      title: 'Game masters',
      description:
        'Quem mestra: people who run games, with their systems, rating and open tables. ' +
        'get_profile reads one of them.',
      inputSchema: {
        query: z.string().max(100).optional().describe('Name or username.'),
        system: SLUG.optional().describe('A game system slug.'),
        place: SLUG.optional().describe('A place slug.'),
        modality: z.enum(['online', 'in_person']).optional(),
        open: z.boolean().optional().describe('Only people with an open table now.'),
        sort: z.enum(['recent', 'score', 'tables', 'name']).optional(),
        page: PAGE,
      },
      annotations: READ,
    },
    async ({ query, system, place, modality, open, sort, page: n }) =>
      behind('api_directory_gms', 'list_gamemasters', async () =>
        read(
          `/v1/reads/gamemasters${queryOf({ q: query, system, place, modality, open, sort, page: page(n), badges: await isEnabled('use_badges') })}`,
        ),
      ),
  );

  server.registerTool(
    'get_profile',
    {
      title: 'Read a profile',
      description:
        "Someone's public profile (/u/<username>): about them, the tables they run, ratings " +
        'and reviews.',
      inputSchema: { username: USERNAME, page: PAGE },
      annotations: READ,
    },
    async ({ username, page: n }) =>
      answer(
        'get_profile',
        () =>
          read(
            `/v1/profiles/${encodeURIComponent(username.replace(/^@/, '').toLowerCase())}${queryOf({ page: page(n) })}`,
          ),
        // `subject` targets the page's flags and `follows` feeds its Seguir button: neither is
        // what the profile says, and the follow counts are the owner's alone.
        (body) => {
          const {
            subject: _subject,
            follows: _follows,
            ...profile
          } = body as Record<string, unknown>;
          return profile;
        },
      ),
  );

  server.registerTool(
    'my_notifications',
    {
      title: 'My notifications',
      description: "The caller's notifications (the bell), newest first, and how many are unread.",
      inputSchema: {
        unread: z.boolean().optional().describe('Only the unread ones.'),
        page: PAGE,
      },
      annotations: READ,
    },
    async ({ unread, page: n }) =>
      answer('my_notifications', async () =>
        read(
          `/v1/me/notifications${queryOf({ page: page(n), unread, achievements: await isEnabled('use_badges') })}`,
        ),
      ),
  );

  server.registerTool(
    'list_conversations',
    {
      title: 'My conversations',
      description:
        "The caller's conversations (Mensagens): direct ones and table chats, latest first. " +
        'Reading them here does not mark them read.',
      inputSchema: { kind: z.enum(['direct', 'table']).optional(), page: PAGE },
      annotations: READ,
    },
    async ({ kind, page: n }) =>
      answer('list_conversations', () =>
        read(`/v1/messages/inbox${queryOf({ kind, page: page(n) })}`),
      ),
  );

  server.registerTool(
    'read_conversation',
    {
      title: 'Read a conversation',
      description:
        "A page of messages in one of the caller's conversations, newest last. Pass `before` " +
        "(the oldest message's time) for the page before. Does not mark them read.",
      inputSchema: {
        id: z.uuid().describe('The conversation id, from list_conversations.'),
        before: z.iso.datetime({ offset: true }).optional(),
      },
      annotations: READ,
    },
    async ({ id, before }) =>
      answer('read_conversation', () => read(`/v1/messages/${id}${queryOf({ before })}`)),
  );
}

/** The tool names, for the README and the specs. */
export const TOOL_NAMES = [
  'search_tables',
  'get_table',
  'my_tables',
  'my_calendar',
  'list_systems',
  'get_system',
  'list_places',
  'get_place',
  'list_gamemasters',
  'get_profile',
  'my_notifications',
  'list_conversations',
  'read_conversation',
] as const;
