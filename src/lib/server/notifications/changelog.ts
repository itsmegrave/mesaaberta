import { eq, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { notifications, profiles } from '../db/schema';
import type { ChangelogEntry } from '../../changelog/entries';

/**
 * How long after its date an entry is still announced. Shorter than the notifications' retention
 * (90 days), so an entry whose notifications were pruned is never announced again.
 */
export const ANNOUNCE_WINDOW_DAYS = 30;

const DAY = 24 * 3600 * 1000;

/** The entry's summary (rendered Markdown) as the plain sentence a notification shows. */
export function plainSummary(html: string, max = 200): string | null {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The notifications' `eventId` for an entry: a name-based UUID (v5 layout, SHA-1) of its slug. The
 * unique (event, recipient) index then makes a second announcement of it impossible.
 */
export async function announcementId(slug: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`changelog:${slug}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Puts each published changelog entry in the bell of every active person, once: a system
 * announcement with the entry's title and summary, linking to it on `/changelog`. Run by the
 * sweeper on every Cron Trigger, so a deploy with a new entry announces it within minutes.
 * Drafts, entries dated after today and entries older than `ANNOUNCE_WINDOW_DAYS` are skipped.
 * Returns how many entries were announced.
 */
export async function announceChangelog(
  db: AnyDb,
  entries: readonly ChangelogEntry[],
  now = new Date(),
): Promise<number> {
  const today = now.toISOString().slice(0, 10);
  const oldest = new Date(now.getTime() - ANNOUNCE_WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  let announced = 0;

  for (const entry of entries) {
    if (entry.draft || entry.date > today || entry.date < oldest) continue;
    const eventId = await announcementId(entry.slug);

    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.eventId, eventId))
      .limit(1);
    if (already) continue;

    // One statement for everyone, so a large audience costs one round trip.
    await db
      .insert(notifications)
      .select(
        db
          .select({
            id: sql`gen_random_uuid()`.as('id'),
            recipientId: profiles.id,
            actorId: sql`null`.as('actor_id'),
            eventId: sql`${eventId}::uuid`.as('event_id'),
            category: sql`'system'::notification_category`.as('category'),
            type: sql`'system_announcement'`.as('type'),
            icon: sql`null`.as('icon'),
            title: sql`${entry.title}`.as('title'),
            body: sql`${plainSummary(entry.summary)}`.as('body'),
            link: sql`${`/changelog#${entry.slug}`}`.as('link'),
            metadata: sql`'{}'::jsonb`.as('metadata'),
            readAt: sql`null`.as('read_at'),
            createdAt: sql`${now.toISOString()}::timestamptz`.as('created_at'),
          })
          .from(profiles)
          .where(eq(profiles.status, 'active')),
      )
      .onConflictDoNothing();
    announced++;
  }
  return announced;
}
