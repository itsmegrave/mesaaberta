import { and, eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import { expandWelcomeMessage } from '../../tables/welcome';
import { buildInvite, tableUrl, uidDomainFor, type CalendarTable } from '../calendar/ics';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations } from '../db/schema';
import type { Mailer } from '../mail/mailer';
import { mailConfigured, mailerFor } from '../mail';
import {
  playerMessageHtml,
  playerMessageText,
  templateIdFor,
  templateVariables,
  type TemplateEnv,
  type TemplateKey,
  type TemplateVariables,
} from '../mail/templates';
import { formatSession } from '../../tables/format';
import type { Handler, StoredEvent } from './types';
import { NAMELESS } from '../db/public-name';
import { atHandle } from '../../profile/handle';

/** Secrets stay in the Worker environment. Do not put any of these in `wrangler.jsonc`. */
export type InviteEnv = TemplateEnv & {
  /** Local/E2E provider. When present it wins over Resend and captures messages in Mailpit. */
  /** `none` drops every e-mail; unset sends through Mailpit or Resend. */
  MAIL_PROVIDER?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SUPABASE_URL?: string;
  /** A Supabase secret key (`sb_secret_...`). It bypasses RLS: server-only. */
  SUPABASE_SECRET_KEY?: string;
  /** The legacy `service_role` key, still accepted until Supabase retires it (end of 2026). */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ORIGIN?: string;
  /** The namespace of calendar UIDs; never change it once invites went out (see `uidDomainFor`). */
  CALENDAR_UID_DOMAIN?: string;
};

/** What the handler needs once `inviteHandler` has checked the environment and picked the admin key. */
type InviteConfig = TemplateEnv & {
  MAIL_PROVIDER?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  APP_ORIGIN: string;
  CALENDAR_UID_DOMAIN: string;
};

type Recipient = {
  id: string;
  name: string | null;
  username: string | null;
  /** The zone the time in the e-mail is written in; the table's when the person has none. */
  timezone: string | null;
};

const recipientColumns = {
  id: profiles.id,
  name: profiles.name,
  username: profiles.username,
  timezone: profiles.timezone,
};

const calendarColumns = {
  id: gameTables.id,
  status: gameTables.status,
  slug: gameTables.slug,
  title: gameTables.title,
  description: gameTables.description,
  extraInfo: gameTables.extraInfo,
  welcomeMessage: gameTables.welcomeMessage,
  kind: gameTables.kind,
  startsAt: gameTables.startsAt,
  durationMinutes: gameTables.durationMinutes,
  timezone: gameTables.timezone,
  recurrence: gameTables.recurrence,
  until: gameTables.until,
  icalSequence: gameTables.icalSequence,
  gmId: gameTables.gmId,
};

/** Resend accepts `Name <address@example.com>`; iCalendar's ORGANIZER needs only the address. */
const addressOf = (from: string) => from.match(/<([^<>]+)>\s*$/)?.[1] ?? from;

const localFrom = 'Mesa Aberta <no-reply@mesaaberta.local>';

type InviteTable = CalendarTable & {
  gmId: string;
  welcomeMessage: string | null;
  status: typeof gameTables.$inferSelect.status;
};

async function tableOf(db: AnyDb, tableId: string) {
  const [table] = await db
    .select(calendarColumns)
    .from(gameTables)
    .where(eq(gameTables.id, tableId));
  if (!table) throw new Error('Table for invite event no longer exists');
  return table as InviteTable;
}

async function profileOf(db: AnyDb, id: string): Promise<Recipient[]> {
  const [profile] = await db.select(recipientColumns).from(profiles).where(eq(profiles.id, id));
  return profile ? [profile] : [];
}

/** The introduction a player left with a request, and who they are; none once the request is gone. */
async function requestMessageOf(db: AnyDb, tableId: string, playerId: string) {
  const [row] = await db
    .select({ message: registrations.message, username: profiles.username })
    .from(registrations)
    .innerJoin(profiles, eq(profiles.id, registrations.playerId))
    .where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)));
  return row;
}

async function confirmedRecipients(db: AnyDb, tableId: string): Promise<Recipient[]> {
  return db
    .select(recipientColumns)
    .from(registrations)
    .innerJoin(profiles, eq(profiles.id, registrations.playerId))
    .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
}

/** The event types this handler is registered for (`types` below) — never `UserSignedIn`, which
 *  the dispatcher never routes here, but which TypeScript cannot rule out from plain `StoredEvent`. */
type InviteEvent = Extract<
  StoredEvent,
  {
    type:
      | 'TableCreated'
      | 'JoinRequested'
      | 'JoinApproved'
      | 'PlayerJoined'
      | 'JoinDeclined'
      | 'PlayerLeft'
      | 'TableUpdated'
      | 'TableSessionHeld'
      | 'TableDisabled';
  }
>;

async function recipientsFor(
  db: AnyDb,
  event: InviteEvent,
  table: InviteTable,
): Promise<Recipient[]> {
  if ('playerId' in event.payload) {
    return event.type === 'JoinRequested'
      ? profileOf(db, table.gmId)
      : profileOf(db, event.payload.playerId);
  }
  if (event.type === 'TableCreated') return profileOf(db, table.gmId);
  const players = await confirmedRecipients(db, event.payload.tableId);
  const gm = await profileOf(db, table.gmId);
  return [...gm, ...players];
}

type Context = TemplateVariables['CONTEXT'];

/**
 * Sends calendar REQUESTs for confirmed joins and table changes, and CANCELs when a player leaves
 * or the table is disabled. A Resend idempotency key makes retries of an outbox event safe even if
 * the first attempt reached Resend before the Worker stopped.
 */
export function createInviteHandler(
  env: InviteConfig,
  request: typeof fetch = fetch,
  admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  mailer: Mailer = mailerFor(env, request),
): Handler {
  return {
    name: 'calendar-invites-v1',
    types: [
      'TableCreated',
      'JoinRequested',
      'JoinApproved',
      'PlayerJoined',
      'JoinDeclined',
      'PlayerLeft',
      'TableUpdated',
      // A campaign or adventure that goes on moves to its next session: the calendar follows.
      'TableSessionHeld',
      'TableDisabled',
    ],
    async handle(event: InviteEvent, db) {
      // A draft has no players and no session anyone was invited to: nothing to send or cancel.
      if ('draft' in event.payload && event.payload.draft) return;
      const table = await tableOf(db, event.payload.tableId);
      const method =
        event.type === 'PlayerLeft' || event.type === 'TableDisabled' ? 'CANCEL' : 'REQUEST';
      // Queue order is not guaranteed. A delayed create/join/edit must not recreate a calendar
      // entry after the table's cancellation, including an edit made through the legacy form.
      if (table.status === 'disabled' && method === 'REQUEST') return;
      const recipients = await recipientsFor(db, event, table);
      const notification = event.type === 'JoinRequested' || event.type === 'JoinDeclined';
      const url = tableUrl(env.APP_ORIGIN, table.slug);
      // Written in each person's own timezone, like the site shows it to them.
      const startsAtFor = (recipient: Recipient) =>
        formatSession(table.startsAt, recipient.timezone ?? table.timezone, 'pt-BR');
      /** A hosted template when its id is configured; otherwise the mail keeps its inline copy. */
      const hosted = (
        key: TemplateKey,
        context: Context,
        recipient: Recipient,
        fallbackText: string,
        playerMessage?: string,
      ) => {
        const id = templateIdFor(env, key);
        if (!id) return {};
        const variables = templateVariables({
          RECIPIENT_NAME: recipient.name || recipient.username || NAMELESS,
          TABLE_TITLE: table.title,
          TABLE_URL: url,
          CONTEXT: context,
          STARTS_AT: startsAtFor(recipient),
          FALLBACK_TEXT: fallbackText,
          PLAYER_MESSAGE: playerMessage,
        });
        return { template: { id, variables } };
      };
      // Only the player who just got a seat is welcomed, never a later update or the GM.
      const welcomeMessage =
        event.type === 'JoinApproved' || event.type === 'PlayerJoined'
          ? (expandWelcomeMessage(table.welcomeMessage, table.title) ?? undefined)
          : undefined;
      for (const recipient of recipients) {
        const email = await emailOf(admin, recipient.id);
        if (notification) {
          const toGm = event.type === 'JoinRequested';
          // The player's introduction goes to the GM alone, read now: the event never carries it.
          const request =
            toGm && 'playerId' in event.payload
              ? await requestMessageOf(db, table.id, event.payload.playerId)
              : undefined;
          const who = atHandle(request?.username);
          const intro = playerMessageText(who, request?.message);
          const base = toGm
            ? `Há uma nova solicitação para a mesa "${table.title}".`
            : `Sua solicitação para a mesa "${table.title}" foi recusada.`;
          const text = intro ? `${base}\n\n${intro}` : base;
          await mailer.send({
            to: email,
            subject: toGm
              ? `Nova solicitação: ${table.title}`
              : `Solicitação recusada: ${table.title}`,
            text,
            ...(toGm
              ? hosted(
                  'joinRequested',
                  'JOIN_REQUESTED',
                  recipient,
                  text,
                  playerMessageHtml(who, request?.message),
                )
              : hosted('joinDeclined', 'JOIN_DECLINED', recipient, text)),
            idempotencyKey: `${event.id}:${recipient.id}:notification`,
          });
          continue;
        }
        const ics = buildInvite({
          table,
          method,
          attendee: { email, name: recipient.name || recipient.username || NAMELESS },
          organizer: { email: addressOf(env.RESEND_FROM), name: 'Mesa Aberta' },
          baseUrl: env.APP_ORIGIN,
          uidDomain: env.CALENDAR_UID_DOMAIN,
        });
        // The GM runs the table and has no seat: their copy says what happened to their table, never
        // "your seat is confirmed", and it skips the players' hosted templates.
        const gmMail =
          recipient.id === table.gmId
            ? gmCopy(event.type, method, table.title, startsAtFor(recipient))
            : null;
        const subject =
          gmMail?.subject ??
          (method === 'REQUEST' ? `Convite: ${table.title}` : `Cancelada: ${table.title}`);
        const text =
          gmMail?.text ??
          (method === 'REQUEST'
            ? `Você tem uma vaga confirmada em "${table.title}". O convite de calendário está anexado.`
            : `Sua participação em "${table.title}" foi cancelada. O cancelamento de calendário está anexado.`);
        await mailer.send({
          to: email,
          subject,
          text,
          ...(gmMail
            ? {}
            : method === 'REQUEST'
              ? hosted('invite', 'REQUEST', recipient, text)
              : hosted('cancel', 'CANCEL', recipient, text)),
          welcomeMessage,
          attachments: [
            {
              filename: 'mesa-aberta.ics',
              content: ics,
              contentType: `text/calendar; method=${method}; charset=utf-8`,
            },
          ],
          idempotencyKey: `${event.id}:${recipient.id}:${method}`,
        });
      }
    },
  };
}

/**
 * What the GM reads about their own table: created, moved to its next session, changed or
 * cancelled, with the session as they would see it. The calendar file goes along either way.
 */
function gmCopy(
  type: InviteEvent['type'],
  method: 'REQUEST' | 'CANCEL',
  title: string,
  startsAt: string,
): { subject: string; text: string } {
  if (method === 'CANCEL')
    return {
      subject: `Mesa cancelada: ${title}`,
      text: `Sua mesa "${title}" foi cancelada. O cancelamento de calendário está anexado.`,
    };
  if (type === 'TableCreated')
    return {
      subject: `Mesa criada: ${title}`,
      text: `Sua mesa "${title}" foi criada. A sessão é ${startsAt}. O convite de calendário está anexado.`,
    };
  if (type === 'TableSessionHeld')
    return {
      subject: `Próxima sessão: ${title}`,
      text: `A próxima sessão da sua mesa "${title}" é ${startsAt}. O convite de calendário anexado atualiza o evento na sua agenda.`,
    };
  return {
    subject: `Mesa atualizada: ${title}`,
    text: `Sua mesa "${title}" foi atualizada. A sessão é ${startsAt}. O convite de calendário anexado atualiza o evento na sua agenda.`,
  };
}

/** Where links in a mail point when the deployment set no `APP_ORIGIN`: the local dev server. */
export const LOCAL_ORIGIN = 'http://localhost:5173';

/** No secrets in local development means no handler; events still complete as audit rows. */
export function inviteHandler(env: InviteEnv | undefined): Handler | null {
  const secretKey = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
  const from =
    env?.RESEND_FROM || (env?.MAILPIT_URL || env?.MAIL_PROVIDER === 'none' ? localFrom : undefined);
  if (!env?.SUPABASE_URL || !secretKey || !from) return null;
  if (!mailConfigured(env)) return null;

  return createInviteHandler({
    RESEND_TEMPLATE_INVITE: env.RESEND_TEMPLATE_INVITE,
    RESEND_TEMPLATE_CANCEL: env.RESEND_TEMPLATE_CANCEL,
    RESEND_TEMPLATE_JOIN_REQUESTED: env.RESEND_TEMPLATE_JOIN_REQUESTED,
    RESEND_TEMPLATE_JOIN_DECLINED: env.RESEND_TEMPLATE_JOIN_DECLINED,
    RESEND_TEMPLATE_ACCOUNT_BANNED: env.RESEND_TEMPLATE_ACCOUNT_BANNED,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM: from,
    MAIL_PROVIDER: env.MAIL_PROVIDER,
    MAILPIT_URL: env.MAILPIT_URL,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: secretKey,
    APP_ORIGIN: env.APP_ORIGIN || LOCAL_ORIGIN,
    CALENDAR_UID_DOMAIN: uidDomainFor(env),
  });
}
