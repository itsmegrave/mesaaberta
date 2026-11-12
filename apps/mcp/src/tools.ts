import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AnyFlagName } from '@mesaaberta/core/server/flags/flags';
import { logger } from '@mesaaberta/core/server/logger';
import { TOOL_KINDS, TOOL_LIMITS } from '@mesaaberta/core/tools/schema';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_TONES,
} from '@mesaaberta/contracts';
import { ANNOUNCEMENT_LIMITS } from '@mesaaberta/core/notifications/announcement';
import { plainToHtml } from '@mesaaberta/core/text/rich';
import { z } from 'zod';
import { queryOf, type ApiAnswer, type ApiReader, type ApiWriter } from './api';

/** What a tool needs: the api as the caller, and the caller's flags. */
export type ToolContext = {
  read: ApiReader;
  write: ApiWriter;
  isEnabled: (flag: AnyFlagName) => Promise<boolean>;
  userId: string;
};

const SLUG = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const USERNAME = z.string().regex(/^@?[a-z0-9]+(?:-[a-z0-9]+)*$/i);
const PAGE = z.number().int().min(1).optional().describe('Page number, from 1.');

// Most tools only read. The few that write add something and never remove or overwrite anything;
// the api checks the caller's permission for each one as it does for the site's own forms.
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/** The refusal a tool answers, as a code the model can act on; never the api's own text. */
const refusal = (status: number) =>
  status === 404
    ? 'not_found'
    : status === 401 || status === 403
      ? 'forbidden'
      : status === 429
        ? 'rate_limited'
        : 'unavailable';

/** The api's 400 as the field and the code it named (codes such as `duplicate`, never prose). */
const invalid = (body: unknown) => {
  const { field, message } = (body ?? {}) as { field?: unknown; message?: unknown };
  return {
    error: 'invalid',
    ...(typeof field === 'string' && field ? { field } : {}),
    ...(typeof message === 'string' && message ? { code: message } : {}),
  };
};

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
  const { read, write, isEnabled, userId } = context;

  const ok = ({ status }: ApiAnswer) => status >= 200 && status < 300;

  const refused = (tool: string, { status, body }: ApiAnswer, extra: object = {}) => {
    logger.info('mcp.tool_refused', { tool, status, userId });
    return result(
      { ...(status === 400 ? invalid(body) : { error: refusal(status) }), ...extra },
      true,
    );
  };

  const failed = (tool: string, error: unknown, extra: object = {}) => {
    logger.warn('mcp.tool_failed', { tool, code: 'api_call_failed', userId, error });
    return result({ error: 'unavailable', ...extra }, true);
  };

  const answer = async (
    tool: string,
    call: () => Promise<ApiAnswer>,
    shape: (body: unknown) => unknown = (body) => body,
  ) => {
    try {
      const answered = await call();
      if (ok(answered)) return result(shape(answered.body));
      return refused(tool, answered);
    } catch (error) {
      return failed(tool, error);
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
      answer(
        'search_tables',
        () => read(`/v1/reads/tables${queryOf({ system, modality, platform, tag, gm })}`),
        // Only the tables: the rest feeds the page's filter menus (every system on the site, some
        // 40 KB), too big for a tool answer and already in list_systems.
        (body) => ({ tables: (body as { tables?: unknown }).tables ?? [] }),
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
      answer(
        'get_table',
        () => read(`/v1/reads/detail/${encodeURIComponent(slug)}`),
        // `reportTargets` feeds the page's Denunciar menu; the seats are already in `registrations`.
        (body) => {
          const { reportTargets: _reportTargets, ...page } = body as Record<string, unknown>;
          return page;
        },
      ),
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

  server.registerTool(
    'list_tools',
    {
      title: 'Tools (Ferramentas)',
      description:
        'Ferramentas: the platforms and helpers people use to play (virtual tabletops, chat, ' +
        'calls, helpers), with their site and short description.',
      inputSchema: { query: z.string().max(100).optional().describe('Part of the name.') },
      annotations: READ,
    },
    async ({ query }) => answer('list_tools', () => read(`/v1/tools${queryOf({ q: query })}`)),
  );

  server.registerTool(
    'add_tool',
    {
      title: 'Add a tool (Ferramentas)',
      description:
        'Adds a tool to Ferramentas (/tools) and approves it, so it is listed at once. Admins ' +
        'only. Write the name and description in Brazilian Portuguese, as the page is. A site ' +
        'already listed is refused (`invalid`, field `siteUrl`). The logo is added on the site, ' +
        'in Admin > Ferramentas. Confirm the details with the person before calling.',
      inputSchema: {
        name: z.string().trim().min(1).max(TOOL_LIMITS.name),
        siteUrl: z.string().trim().min(1).max(2048).describe('The address, such as "https://…".'),
        kind: z
          .enum(TOOL_KINDS)
          .describe('vtt (virtual tabletop), chat, call (voice/video) or helper (anything else).'),
        description: z
          .string()
          .trim()
          .min(1)
          .max(TOOL_LIMITS.description)
          .describe('One short sentence on what it does.'),
      },
      annotations: WRITE,
    },
    async (input) => {
      let suggested: ApiAnswer;
      try {
        suggested = await write('/v1/submissions/tools', { input, logoPath: null });
      } catch (error) {
        return failed('add_tool', error);
      }
      const id = (suggested.body as { id?: unknown } | null)?.id;
      if (!ok(suggested) || typeof id !== 'string') return refused('add_tool', suggested);
      // The suggestion is in; approving it is what lists it. If that step fails, the tool waits
      // in Admin > Ferramentas, and the answer says so (`pending`).
      try {
        const approved = await write('/v1/admin/moderation/tool.approve', { id });
        if (!ok(approved)) return refused('add_tool', approved, { id, pending: true });
      } catch (error) {
        return failed('add_tool', error, { id, pending: true });
      }
      return result({ id, listed: true });
    },
  );

  server.registerTool(
    'send_announcement',
    {
      title: 'Send a notification (Admin > Notificações)',
      description:
        "Puts an announcement in people's bell, as Admin > Notificações does. Admins only. Two " +
        'steps: without `confirmed` it sends nothing and answers `{ step: "confirm", count }`, ' +
        'how many people it would reach; tell the person that number and call again with ' +
        '`confirmed: true` only after they say to send. Write it in Brazilian Portuguese. It ' +
        'cannot be taken back once sent.',
      inputSchema: {
        title: z.string().trim().min(1).max(ANNOUNCEMENT_LIMITS.title),
        body: z
          .string()
          .trim()
          .min(1)
          .max(ANNOUNCEMENT_LIMITS.body)
          .describe('Plain text; a blank line starts a new paragraph.'),
        link: z
          .string()
          .trim()
          .max(ANNOUNCEMENT_LIMITS.link)
          .regex(/^\/(?!\/)\S*$/)
          .optional()
          .describe('A path on the site, such as "/changelog".'),
        tone: z
          .enum(ANNOUNCEMENT_TONES)
          .optional()
          .describe('info (default), warning, announcement.'),
        icon: z.enum(ANNOUNCEMENT_ICONS).optional().describe("Empty: the tone's icon."),
        audience: z
          .enum(ANNOUNCEMENT_AUDIENCES)
          .optional()
          .describe('all_active_users (default), game_masters, active_players, specific_user.'),
        recipient: z
          .string()
          .trim()
          .max(ANNOUNCEMENT_LIMITS.recipient)
          .optional()
          .describe('A username, only for specific_user.'),
        confirmed: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    async ({ title, body, link, tone, icon, audience, recipient, confirmed }) =>
      answer(
        'send_announcement',
        () =>
          write('/v1/admin/announcements', {
            title,
            body: plainToHtml(body),
            link: link ?? '',
            tone: tone ?? 'info',
            icon: icon ?? '',
            audience: audience ?? 'all_active_users',
            recipient: recipient ?? '',
            confirmed: confirmed ?? false,
          }),
        // The api's event ids are for the dispatcher; the worker's sweep delivers them.
        (answered) => {
          const { eventIds: _eventIds, ...rest } = (answered ?? {}) as Record<string, unknown>;
          return rest;
        },
      ),
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
  'list_tools',
  'add_tool',
  'send_announcement',
] as const;

/** The tools that change something on the site; every other one only reads. */
export const WRITE_TOOL_NAMES = [
  'add_tool',
  'send_announcement',
] as const satisfies readonly (typeof TOOL_NAMES)[number][];
