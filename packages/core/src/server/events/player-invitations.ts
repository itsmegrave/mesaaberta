import { and, eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import {
  gameTables,
  profiles,
  playerInvitations,
  gmInviteBlocks,
  notifications,
} from '../db/schema';
import type { Mailer } from '../mail/mailer';
import { mailConfigured, mailerFor } from '../mail';
import { templateIdFor, templateVariables } from '../mail/templates';
import { formatSession } from '../../tables/format';
import type { Handler, StoredEvent } from './types';
import { LOCAL_ORIGIN, type InviteEnv } from './invites';
import type { AnyDb } from '../db/client';

type InvitationEvent = Extract<
  StoredEvent,
  {
    type:
      | 'PlayerInvited'
      | 'InvitationAccepted'
      | 'InvitationDeclined'
      | 'InvitationExpired'
      | 'InvitationCancelled';
  }
>;
type Config = InviteEnv & {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  RESEND_FROM: string;
  APP_ORIGIN: string;
};

export function playerInvitationMail(input: {
  name: string;
  gm: string;
  title: string;
  startsAt: Date;
  expiresAt: Date;
  timezone: string;
  url: string;
}) {
  return {
    subject: `Convite para jogar: ${input.title}`,
    text: [
      `Olá, ${input.name}.`,
      '',
      `@${input.gm} convidou você para a mesa “${input.title}”.`,
      `Sessão: ${formatSession(input.startsAt, input.timezone, 'pt-BR')}.`,
      `Sua vaga fica reservada até ${formatSession(input.expiresAt, input.timezone, 'pt-BR')}.`,
      'Revise o convite e escolha aceitar ou recusar. Sua participação só será confirmada depois do aceite.',
      input.url,
      '',
      'Você pode desativar convites ou bloquear convites deste mestre no seu perfil.',
    ].join('\n'),
  };
}

/** Fresh eligibility gates obsolete outbox messages; no access details enter this query or e-mail. */
async function currentInvitation(db: AnyDb, id: string, now = new Date()) {
  const [invitation] = await db
    .select()
    .from(playerInvitations)
    .where(eq(playerInvitations.id, id));
  if (!invitation || invitation.status !== 'pending' || invitation.expiresAt <= now) return null;
  const [table] = await db
    .select({
      title: gameTables.title,
      startsAt: gameTables.startsAt,
      timezone: gameTables.timezone,
      status: gameTables.status,
    })
    .from(gameTables)
    .where(eq(gameTables.id, invitation.tableId));
  const [player] = await db
    .select({
      username: profiles.username,
      status: profiles.status,
      enabled: profiles.invitationsEnabled,
    })
    .from(profiles)
    .where(eq(profiles.id, invitation.playerId));
  const [gm] = await db
    .select({ username: profiles.username, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, invitation.gmId));
  const [block] = await db
    .select({ gmId: gmInviteBlocks.gmId })
    .from(gmInviteBlocks)
    .where(
      and(
        eq(gmInviteBlocks.playerId, invitation.playerId),
        eq(gmInviteBlocks.gmId, invitation.gmId),
      ),
    );
  if (
    !table ||
    table.status !== 'active' ||
    table.startsAt <= now ||
    !player?.enabled ||
    player.status !== 'active' ||
    gm?.status !== 'active' ||
    block
  )
    return null;
  return { invitation, table, player, gm };
}

export function createPlayerInvitationMailHandler(
  env: Config,
  request: typeof fetch = fetch,
  admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  mailer: Mailer = mailerFor(env, request),
): Handler {
  return {
    name: 'player-invitation-mail-v1',
    types: ['PlayerInvited'],
    async handle(event, db) {
      const invited = event as InvitationEvent;
      const current = await currentInvitation(db, invited.payload.invitationId);
      if (!current) return;
      const { invitation, table, player, gm } = current;
      const url = new URL(`/u/profile/invitations/${invitation.id}`, env.APP_ORIGIN).href;
      const mail = playerInvitationMail({
        name: player.username!,
        gm: gm.username!,
        title: table.title,
        startsAt: table.startsAt,
        expiresAt: invitation.expiresAt,
        timezone: table.timezone,
        url,
      });
      const templateId = templateIdFor(env, 'playerInvitation');
      await mailer.send({
        to: await emailOf(admin, invitation.playerId),
        ...mail,
        ...(templateId
          ? {
              template: {
                id: templateId,
                variables: templateVariables({
                  RECIPIENT_NAME: player.username!,
                  TABLE_TITLE: table.title,
                  TABLE_URL: url,
                  CONTEXT: 'PLAYER_INVITATION',
                  STARTS_AT: formatSession(table.startsAt, table.timezone, 'pt-BR'),
                  GM_NAME: gm.username!,
                  EXPIRES_AT: formatSession(invitation.expiresAt, table.timezone, 'pt-BR'),
                  FALLBACK_TEXT: mail.text,
                }),
              },
            }
          : {}),
        idempotencyKey: `player-invitation-${event.id}-${invitation.playerId}`,
      });
    },
  };
}
export function playerInvitationMailHandler(env: InviteEnv | undefined): Handler | null {
  const secret = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
  const from =
    env?.RESEND_FROM ||
    (env?.MAILPIT_URL || env?.MAIL_PROVIDER === 'none'
      ? 'Mesa Aberta <no-reply@mesaaberta.local>'
      : undefined);
  if (!env?.SUPABASE_URL || !secret || !from || !mailConfigured(env)) return null;
  return createPlayerInvitationMailHandler({
    ...env,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: secret,
    RESEND_FROM: from,
    APP_ORIGIN: env.APP_ORIGIN || LOCAL_ORIGIN,
  });
}
export const playerInvitationNotificationHandler: Handler = {
  name: 'player-invitation-notifications-v1',
  types: ['PlayerInvited', 'InvitationDeclined', 'InvitationExpired', 'InvitationCancelled'],
  async handle(event, db) {
    const item = event as InvitationEvent;
    // PlayerJoined already notifies the GM and sends the calendar after acceptance.
    if (item.type === 'InvitationAccepted') return;
    if (item.type === 'PlayerInvited' && !(await currentInvitation(db, item.payload.invitationId)))
      return;
    const [table] = await db
      .select({ title: gameTables.title, slug: gameTables.slug })
      .from(gameTables)
      .where(eq(gameTables.id, item.payload.tableId));
    if (!table) return;
    const received =
      item.type === 'PlayerInvited' ||
      item.type === 'InvitationCancelled' ||
      item.type === 'InvitationExpired';
    const recipientId = received ? item.payload.playerId : item.payload.gmId;
    if (recipientId === event.actorId) return;
    const types = {
      PlayerInvited: 'player_invited',
      InvitationAccepted: 'invitation_accepted',
      InvitationDeclined: 'invitation_declined',
      InvitationExpired: 'invitation_expired',
      InvitationCancelled: 'invitation_cancelled',
    } as const;
    await db
      .insert(notifications)
      .values({
        recipientId,
        actorId: event.actorId,
        eventId: event.id,
        category: 'registration',
        type: types[item.type],
        link: received
          ? `/u/profile/invitations/${item.payload.invitationId}`
          : `/t/${table.slug}/manage`,
        metadata: { tableId: item.payload.tableId, slug: table.slug, title: table.title },
        createdAt: event.createdAt,
      })
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};
