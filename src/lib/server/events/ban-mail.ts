import { eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import { profiles } from '../db/schema';
import { NAMELESS } from '../db/public-name';
import type { Mailer } from '../mail/mailer';
import { mailpitMailer } from '../mail/mailpit';
import { resendMailer } from '../mail/resend';
import { templateIdFor, templateVariables, type TemplateEnv } from '../mail/templates';
import type { InviteEnv } from './invites';
import type { Handler, StoredEvent } from './types';

type BanConfig = TemplateEnv & {
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  APP_ORIGIN: string;
};

type BanEvent = Extract<StoredEvent, { type: 'AccountBanned' }>;

const localFrom = 'Mesa Aberta <no-reply@mesaaberta.local>';

/** The day a ban ends, as the person reads it (Brasília time: the platform's own). */
const endOf = (until: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(until));

/** The sentence that says what happened and until when. */
export const banSummary = (until: string | null) =>
  until
    ? `Sua conta na Mesa Aberta foi suspensa pela moderação até ${endOf(until)}.`
    : 'Sua conta na Mesa Aberta foi banida pela moderação de forma permanente.';

/** The e-mail a banned person gets: what happened, why, and until when. Plain text, pt-BR. */
export function banMail(input: { name: string; until: string | null; reason: string }) {
  const how = banSummary(input.until);
  const after = input.until
    ? 'Depois dessa data você pode entrar de novo normalmente. Até lá, não é possível entrar, abrir mesas nem participar delas.'
    : 'Não é possível entrar, abrir mesas nem participar delas.';
  return {
    subject: input.until ? 'Sua conta foi suspensa temporariamente' : 'Sua conta foi banida',
    text: [
      `Olá, ${input.name}.`,
      '',
      how,
      '',
      'Motivo informado pela moderação:',
      input.reason,
      '',
      after,
      'As mesas que você mestrava foram canceladas e você saiu das mesas em que jogava.',
      '',
      'Se você acredita que houve um engano, responda este e-mail.',
      '',
      'Equipe Mesa Aberta',
    ].join('\n'),
  };
}

/**
 * E-mails the banned person, with the reason the admin wrote and, for a temporary ban, when it
 * ends. Once per event: the event id is the idempotency key, so a retry sends nothing new. The
 * reason is read from the profile (the event keeps no text); a ban revoked before the dispatch is
 * not sent.
 */
export function createBanMailHandler(
  env: BanConfig,
  request: typeof fetch = fetch,
  admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  mailer: Mailer = env.MAILPIT_URL
    ? mailpitMailer({ MAILPIT_URL: env.MAILPIT_URL, RESEND_FROM: env.RESEND_FROM }, request)
    : resendMailer({ RESEND_API_KEY: env.RESEND_API_KEY!, RESEND_FROM: env.RESEND_FROM }, request),
): Handler {
  return {
    name: 'ban-mail-v1',
    types: ['AccountBanned'],
    async handle(event, db) {
      const { profileId, until } = (event as BanEvent).payload;
      const [profile] = await db
        .select({
          name: profiles.name,
          username: profiles.username,
          status: profiles.status,
          banReason: profiles.banReason,
        })
        .from(profiles)
        .where(eq(profiles.id, profileId));
      if (!profile || profile.status !== 'suspended' || !profile.banReason) return;

      const mail = banMail({
        name: profile.name || profile.username || NAMELESS,
        until,
        reason: profile.banReason,
      });
      const name = profile.name || profile.username || NAMELESS;
      // The hosted template when its id is set; otherwise the inline text above, so a ban is never
      // left unannounced because the template is not configured yet.
      const id = templateIdFor(env, 'accountBanned');
      await mailer.send({
        to: await emailOf(admin, profileId),
        ...mail,
        ...(id
          ? {
              template: {
                id,
                variables: templateVariables({
                  RECIPIENT_NAME: name,
                  BAN_SUMMARY: banSummary(until),
                  BAN_REASON: profile.banReason,
                  FALLBACK_TEXT: mail.text,
                }),
              },
            }
          : {}),
        idempotencyKey: `ban-${event.id}`,
      });
    },
  };
}

/** Like the invites: without the e-mail and Auth settings there is no handler. */
export function banMailHandler(env: InviteEnv | undefined): Handler | null {
  const secretKey = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
  const from = env?.RESEND_FROM || (env?.MAILPIT_URL ? localFrom : undefined);
  if (!env?.SUPABASE_URL || !secretKey || !from) return null;
  if (!env.MAILPIT_URL && !env.RESEND_API_KEY) return null;

  return createBanMailHandler({
    RESEND_TEMPLATE_ACCOUNT_BANNED: env.RESEND_TEMPLATE_ACCOUNT_BANNED,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM: from,
    MAILPIT_URL: env.MAILPIT_URL,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: secretKey,
    APP_ORIGIN: env.APP_ORIGIN || 'https://mesaaberta.app',
  });
}
