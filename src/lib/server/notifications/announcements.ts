import { and, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events, notifications, profiles } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';
import type { SystemAnnouncement } from '../events/types';
import { countAudience } from './audience';
import {
  TONE_ICON,
  type AnnouncementAudience,
  type AnnouncementIcon,
  type AnnouncementTone,
} from '../../notifications/kinds';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The size of each broad audience, for the console to show next to its choice. */
export async function audienceSizes(db: AnyDb) {
  const [all, gms, players] = await Promise.all([
    countAudience(db, 'all_active_users'),
    countAudience(db, 'game_masters'),
    countAudience(db, 'active_players'),
  ]);
  return { all_active_users: all, game_masters: gms, active_players: players };
}

export type Recipient = { id: string; username: string };

/** The active person a username (with or without @) or a user id names, or null. */
export async function findRecipient(db: AnyDb, query: string): Promise<Recipient | null> {
  const value = query.trim().replace(/^@/, '');
  if (!value) return null;
  const [row] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(
      and(
        eq(profiles.status, 'active'),
        UUID.test(value)
          ? eq(profiles.id, value)
          : sql`lower(${profiles.username}) = ${value.toLowerCase()}`,
      ),
    )
    .limit(1);
  return row?.username ? { id: row.id, username: row.username } : null;
}

/** Active usernames that start with what was typed, for the recipient field's suggestions. */
export async function searchRecipients(db: AnyDb, query: string, limit = 8): Promise<Recipient[]> {
  const value = query.trim().replace(/^@/, '').toLowerCase();
  // Usernames are lowercase letters, digits and hyphens: anything else matches nobody, and no `%`
  // or `_` from the query reaches the pattern.
  if (!/^[a-z0-9-]{1,30}$/.test(value)) return [];
  const rows = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(and(eq(profiles.status, 'active'), ilike(profiles.username, `${value}%`)))
    .orderBy(profiles.username)
    .limit(limit);
  return rows.flatMap((row) => (row.username ? [{ id: row.id, username: row.username }] : []));
}

export type AnnouncementDraft = {
  title: string;
  body: string;
  icon: AnnouncementIcon | '';
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  recipient: string;
  link: string;
  confirmed: boolean;
};

export type SendResult =
  | { step: 'confirm'; count: number; recipient: Recipient | null }
  | { step: 'sent'; count: number; eventId: string };

/**
 * Sends an announcement, in two steps. Unconfirmed, it only works out who it reaches and says how
 * many, for the admin to confirm; confirmed, it records `SystemAnnouncementSent`, whose handler
 * writes the notifications after the response. An audience of nobody is refused either way.
 */
export async function sendAnnouncement(
  db: AnyDb,
  actor: Actor | null,
  draft: AnnouncementDraft,
): Promise<SendResult> {
  authorize(actor, 'admin:access');

  let recipient: Recipient | null = null;
  if (draft.audience === 'specific_user') {
    recipient = await findRecipient(db, draft.recipient);
    if (!recipient) throw new Invalid('recipient', 'not_found');
  }

  const total = await countAudience(db, draft.audience, recipient?.id ?? null);
  if (total === 0) throw new Invalid('audience', 'empty');
  if (!draft.confirmed) return { step: 'confirm', count: total, recipient };

  const payload: SystemAnnouncement = {
    title: draft.title,
    body: draft.body,
    icon: draft.icon || TONE_ICON[draft.tone],
    tone: draft.tone,
    link: draft.link || null,
    audience: draft.audience,
    recipientId: recipient?.id ?? null,
    estimated: total,
  };
  const eventId = await recordEvent(db, {
    type: 'SystemAnnouncementSent',
    actorId: actor!.id,
    payload,
  });
  return { step: 'sent', count: total, eventId };
}

/**
 * The announcements admins sent, newest first: what was sent, by whom, to whom, how many bells it
 * reached, and whether it has been delivered. Kept as long as its event (the audit log).
 */
export async function listAnnouncements(db: AnyDb, limit = 20) {
  const notified = db
    .select({ eventId: notifications.eventId, total: count().as('total') })
    .from(notifications)
    .groupBy(notifications.eventId)
    .as('notified');

  const rows = await db
    .select({
      id: events.id,
      payload: events.payload,
      createdAt: events.createdAt,
      processedAt: events.processedAt,
      failedAt: events.failedAt,
      author: profiles.username,
      notified: notified.total,
    })
    .from(events)
    .leftJoin(profiles, eq(profiles.id, events.actorId))
    .leftJoin(notified, eq(notified.eventId, events.id))
    .where(eq(events.type, 'SystemAnnouncementSent'))
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(limit);

  const recipientIds = [
    ...new Set(
      rows.flatMap((row) => {
        const id = (row.payload as SystemAnnouncement).recipientId;
        return id ? [id] : [];
      }),
    ),
  ];
  const names = new Map(
    recipientIds.length === 0
      ? []
      : (
          await db
            .select({ id: profiles.id, username: profiles.username })
            .from(profiles)
            .where(inArray(profiles.id, recipientIds))
        ).map((row) => [row.id, row.username] as const),
  );

  return rows.map((row) => {
    const payload = row.payload as SystemAnnouncement;
    return {
      id: row.id,
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      tone: payload.tone,
      link: payload.link,
      audience: payload.audience,
      recipient: payload.recipientId ? (names.get(payload.recipientId) ?? null) : null,
      author: row.author,
      notified: Number(row.notified ?? 0),
      sentAt: row.createdAt,
      status: row.processedAt
        ? ('delivered' as const)
        : row.failedAt
          ? ('failed' as const)
          : ('pending' as const),
    };
  });
}

export type AnnouncementRow = Awaited<ReturnType<typeof listAnnouncements>>[number];
