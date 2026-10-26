import { and, eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import { gameTables, profiles, ratings, registrations } from '../db/schema';
import { NAMELESS } from '../db/public-name';
import type { Mailer } from '../mail/mailer';
import { mailConfigured, mailerFor } from '../mail';
import { sendOnce } from '../mail/once';
import { routes } from '../../routes';
import { formatSession } from '../../tables/format';
import { autoCloseAt, sessionEnd } from '../tables/close-reminders';
import { LOCAL_ORIGIN, type InviteEnv } from './invites';
import type { Handler, StoredEvent } from './types';

type Config = {
  MAIL_PROVIDER?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  APP_ORIGIN: string;
};

type ReminderEvent = Extract<StoredEvent, { type: 'TableCloseReminder' }>;
type ConcludedEvent = Extract<StoredEvent, { type: 'TableConcluded' }>;

const localFrom = 'Mesa Aberta <no-reply@mesaaberta.local>';

/** The GM's reminder: did the session happen? The second one says when the table closes itself. */
export function closeReminderMail(input: {
  name: string;
  title: string;
  startsAt: string;
  url: string;
  closesAt?: string;
}) {
  return {
    subject: input.closesAt
      ? `Último lembrete: a sessão de “${input.title}” aconteceu?`
      : `A sessão de “${input.title}” aconteceu?`,
    text: [
      `Olá, ${input.name}.`,
      '',
      `A sessão da sua mesa “${input.title}” (${input.startsAt}) terminou e ainda falta você dizer como foi.`,
      'Conte se ela aconteceu e quem apareceu, adie para outra data ou diga que não rolou:',
      input.url,
      '',
      ...(input.closesAt
        ? [
            `Se não houver resposta até ${input.closesAt}, a mesa será marcada como concluída e quem jogou será convidado a avaliar a sessão.`,
            '',
          ]
        : []),
      'Equipe Mesa Aberta',
    ].join('\n'),
  };
}

/** What a player of a table concluded for its GM is asked: to rate it. */
export function ratingRequestMail(input: { name: string; title: string; url: string }) {
  return {
    subject: `Como foi “${input.title}”? Avalie a mesa`,
    text: [
      `Olá, ${input.name}.`,
      '',
      `A mesa “${input.title}” foi concluída. Conte como foi a sessão e avalie quem mestrou:`,
      input.url,
      '',
      'Sua avaliação ajuda outras pessoas a encontrar boas mesas.',
      '',
      'Equipe Mesa Aberta',
    ].join('\n'),
  };
}

const nameOf = (profile: { name: string | null; username: string | null }) =>
  profile.name || profile.username || NAMELESS;

/**
 * E-mails the GM the reminders to close a session (`TableCloseReminder`), and, when the sweeper
 * concluded a table for its GM (`TableConcluded` with `autoClosed`), asks each confirmed player who
 * has not rated it yet to do so. Each e-mail goes out once (`sendOnce`), so a retry sends only what
 * is missing. A reminder for a table the GM answered meanwhile is not sent, nor anything to an
 * account that is not active.
 */
export function createCloseReminderMailHandler(
  env: Config,
  request: typeof fetch = fetch,
  admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  mailer: Mailer = mailerFor(env, request),
): Handler {
  return {
    name: 'close-reminder-mail-v1',
    types: ['TableCloseReminder', 'TableConcluded'],
    async handle(event, db) {
      if (event.type === 'TableConcluded' && !(event as ConcludedEvent).payload.autoClosed) return;
      const { tableId } = (event as ReminderEvent | ConcludedEvent).payload;
      const [table] = await db
        .select({
          slug: gameTables.slug,
          title: gameTables.title,
          status: gameTables.status,
          startsAt: gameTables.startsAt,
          durationMinutes: gameTables.durationMinutes,
          timezone: gameTables.timezone,
          gmId: gameTables.gmId,
        })
        .from(gameTables)
        .where(eq(gameTables.id, tableId));
      if (!table) return;

      if (event.type === 'TableCloseReminder') {
        if (table.status !== 'awaiting_confirmation') return;
        const [gm] = await db
          .select({ name: profiles.name, username: profiles.username, status: profiles.status })
          .from(profiles)
          .where(eq(profiles.id, table.gmId));
        if (gm?.status !== 'active') return;
        const last = (event as ReminderEvent).payload.step === '7d';
        const mail = closeReminderMail({
          name: nameOf(gm),
          title: table.title,
          startsAt: formatSession(table.startsAt, table.timezone, 'pt-BR'),
          url: new URL(`${routes.table(table.slug)}/manage`, env.APP_ORIGIN).href,
          ...(last
            ? {
                closesAt: formatSession(
                  autoCloseAt(sessionEnd(table.startsAt, table.durationMinutes), event.createdAt),
                  table.timezone,
                  'pt-BR',
                ),
              }
            : {}),
        });
        await sendOnce(db, mailer, {
          to: await emailOf(admin, table.gmId),
          ...mail,
          idempotencyKey: `close-reminder-${event.id}`,
        });
        return;
      }

      if (table.status !== 'concluded') return;
      const players = await db
        .select({
          id: registrations.playerId,
          name: profiles.name,
          username: profiles.username,
          status: profiles.status,
        })
        .from(registrations)
        .innerJoin(profiles, eq(profiles.id, registrations.playerId))
        .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
      const rated = new Set(
        (
          await db
            .select({ id: ratings.playerId })
            .from(ratings)
            .where(eq(ratings.tableId, tableId))
        ).map((row) => row.id),
      );
      const url = new URL(routes.table(table.slug), env.APP_ORIGIN).href;
      for (const player of players) {
        if (player.status !== 'active' || rated.has(player.id) || player.id === table.gmId)
          continue;
        await sendOnce(db, mailer, {
          to: await emailOf(admin, player.id),
          ...ratingRequestMail({ name: nameOf(player), title: table.title, url }),
          idempotencyKey: `rating-request-${event.id}-${player.id}`,
        });
      }
    },
  };
}

/** Like the invites: without the e-mail and Auth settings there is no handler. */
export function closeReminderMailHandler(env: InviteEnv | undefined): Handler | null {
  const secretKey = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
  const from =
    env?.RESEND_FROM || (env?.MAILPIT_URL || env?.MAIL_PROVIDER === 'none' ? localFrom : undefined);
  if (!env?.SUPABASE_URL || !secretKey || !from) return null;
  if (!mailConfigured(env)) return null;

  return createCloseReminderMailHandler({
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM: from,
    MAIL_PROVIDER: env.MAIL_PROVIDER,
    MAILPIT_URL: env.MAILPIT_URL,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: secretKey,
    APP_ORIGIN: env.APP_ORIGIN || LOCAL_ORIGIN,
  });
}
