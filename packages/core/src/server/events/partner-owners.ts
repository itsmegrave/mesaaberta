import { eq } from 'drizzle-orm';
import { createSupabaseAdmin, emailOf, type SupabaseAdmin } from '../auth/admin-client';
import type { AnyDb } from '../db/client';
import { notifications, partnerInvitations, partners, profiles } from '../db/schema';
import { mailConfigured, mailerFor } from '../mail';
import type { Mailer } from '../mail/mailer';
import { NOTIFICATION_KINDS, type NotificationType } from '../../notifications/kinds';
import { LOCAL_ORIGIN, type InviteEnv } from './invites';
import type { Handler, StoredEvent } from './types';

type OwnerEvent = Extract<
  StoredEvent,
  {
    type:
      | 'PartnerOwnerInvited'
      | 'PartnerInvitationAccepted'
      | 'PartnerInvitationDeclined'
      | 'PartnerOwnerRemoved';
  }
>;
type Config = InviteEnv & {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  RESEND_FROM: string;
  APP_ORIGIN: string;
};

/** The invite, while it still waits and its partner is up: a stale outbox entry tells nobody. */
async function waitingInvitation(db: AnyDb, id: string, now = new Date()) {
  const [row] = await db
    .select({
      inviteeId: partnerInvitations.inviteeId,
      status: partnerInvitations.status,
      expiresAt: partnerInvitations.expiresAt,
      removedAt: partners.removedAt,
    })
    .from(partnerInvitations)
    .innerJoin(partners, eq(partners.id, partnerInvitations.partnerId))
    .where(eq(partnerInvitations.id, id));
  return row && row.status === 'pending' && row.expiresAt > now && !row.removedAt ? row : null;
}

/**
 * The bell for who looks after a partner: the invited person hears of the invite (linked to its
 * page), whoever invited hears the answer (linked to the edit page) and an account another owner
 * took off is told, with no link. Leaving tells nobody, nor do a cancelled or lapsed invite. One row
 * per event and recipient, so a retry adds nothing.
 */
export const partnerOwnerNotificationHandler: Handler = {
  name: 'partner-owner-notifications-v1',
  types: [
    'PartnerOwnerInvited',
    'PartnerInvitationAccepted',
    'PartnerInvitationDeclined',
    'PartnerOwnerRemoved',
  ],
  async handle(event, db) {
    const item = event as OwnerEvent;
    const { partnerId, name } = item.payload;
    let recipientId: string;
    let type: NotificationType;
    let link: string | null;
    if (item.type === 'PartnerOwnerInvited') {
      if (!(await waitingInvitation(db, item.payload.invitationId))) return;
      recipientId = item.payload.inviteeId;
      type = 'partner_invited';
      link = `/p/invitations/${item.payload.invitationId}`;
    } else if (item.type === 'PartnerOwnerRemoved') {
      recipientId = item.payload.profileId;
      type = 'partner_owner_removed';
      link = null;
    } else {
      recipientId = item.payload.inviterId;
      type =
        item.type === 'PartnerInvitationAccepted'
          ? 'partner_invitation_accepted'
          : 'partner_invitation_declined';
      link = `/p/${partnerId}/edit`;
    }
    if (recipientId === event.actorId) return;
    await db
      .insert(notifications)
      .values({
        recipientId,
        actorId: event.actorId,
        eventId: event.id,
        category: NOTIFICATION_KINDS[type].category,
        type,
        link,
        metadata: { partnerId, partner: name },
        createdAt: event.createdAt,
      })
      .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
  },
};

export function partnerInvitationMail(input: {
  name: string;
  inviter: string;
  partner: string;
  expiresAt: Date;
  url: string;
}) {
  const until = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Sao_Paulo',
  }).format(input.expiresAt);
  return {
    subject: `Convite para cuidar de ${input.partner}`,
    text: [
      `Olá, ${input.name}.`,
      '',
      `@${input.inviter} convidou você para cuidar de “${input.partner}” na página de parceiros da Mesa Aberta.`,
      'Se aceitar, você pode editar o card, convidar outras contas e recebe os avisos da moderação sobre ele.',
      `O convite vale até ${until}.`,
      `Ver convite: ${input.url}`,
      '',
      'Você pode desativar convites no seu perfil.',
    ].join('\n'),
  };
}

export function createPartnerInvitationMailHandler(
  env: Config,
  request: typeof fetch = fetch,
  admin: SupabaseAdmin = createSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  mailer: Mailer = mailerFor(env, request),
): Handler {
  return {
    name: 'partner-invitation-mail-v1',
    types: ['PartnerOwnerInvited'],
    async handle(event, db) {
      const invited = event as Extract<StoredEvent, { type: 'PartnerOwnerInvited' }>;
      const { invitationId, inviteeId, inviterId, name } = invited.payload;
      const current = await waitingInvitation(db, invitationId);
      if (!current) return;
      const [invitee] = await db
        .select({
          username: profiles.username,
          status: profiles.status,
          enabled: profiles.invitationsEnabled,
        })
        .from(profiles)
        .where(eq(profiles.id, inviteeId));
      const [inviter] = await db
        .select({ username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, inviterId));
      if (!invitee?.username || invitee.status !== 'active' || !invitee.enabled) return;
      const to = await emailOf(admin, inviteeId);
      const url = new URL(`/p/invitations/${invitationId}`, env.APP_ORIGIN).href;
      await mailer.send({
        to,
        ...partnerInvitationMail({
          name: invitee.username,
          inviter: inviter?.username ?? '',
          partner: name,
          expiresAt: current.expiresAt,
          url,
        }),
        idempotencyKey: `partner-invitation-${event.id}-${inviteeId}`,
      });
    },
  };
}

export function partnerInvitationMailHandler(env: InviteEnv | undefined): Handler | null {
  const secret = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_SERVICE_ROLE_KEY;
  const from =
    env?.RESEND_FROM ||
    (env?.MAILPIT_URL || env?.MAIL_PROVIDER === 'none'
      ? 'Mesa Aberta <no-reply@mesaaberta.local>'
      : undefined);
  if (!env?.SUPABASE_URL || !secret || !from || !mailConfigured(env)) return null;
  return createPartnerInvitationMailHandler({
    ...env,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: secret,
    RESEND_FROM: from,
    APP_ORIGIN: env.APP_ORIGIN || LOCAL_ORIGIN,
  });
}
