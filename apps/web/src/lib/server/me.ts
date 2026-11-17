import { getTableColumns } from 'drizzle-orm';
import { profiles } from '@mesaaberta/core/server/db/schema';
import type { NotificationItem } from '@mesaaberta/core/server/notifications/service';
import { readFromApi } from './api-read';

// The signed-in person's own frame from the api Worker (Trello #120): the web Worker reads no
// database for these. JSON turned the dates into strings; these give them back as dates.

type Profile = typeof profiles.$inferSelect;

const profileDates = Object.entries(getTableColumns(profiles))
  .filter(([, column]) => column.dataType === 'date')
  .map(([key]) => key);

/** Whether this Worker can reach the api at all (a Service Binding, or a private address). */
export const apiConfigured = (env: App.Locals['env']) => {
  const settings = env as
    { API?: unknown; API_URL?: string; API_INTERNAL_TOKEN?: string } | undefined;
  return !!settings?.API || !!(settings?.API_URL && settings.API_INTERNAL_TOKEN);
};

/** The person's profile row, or null when they have none yet. */
export async function readMe(locals: App.Locals, actorId: string): Promise<Profile | null> {
  const { profile } = await readFromApi<{ profile: Profile | null }>(locals, actorId, '/v1/me');
  if (!profile) return null;
  const revived: Record<string, unknown> = { ...profile };
  for (const key of profileDates) {
    const value = revived[key];
    if (typeof value === 'string') revived[key] = new Date(value);
  }
  return revived as Profile;
}

const reviveNotifications = (items: NotificationItem[]) =>
  items.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    readAt: item.readAt === null ? null : new Date(item.readAt),
  }));

const achievements = (withAchievements: boolean) => (withAchievements ? 'achievements=1' : '');

/** The header: the bell's number and latest few, unread conversations, waiting suggestions. */
export async function readShell(locals: App.Locals, actorId: string, withAchievements: boolean) {
  const shell = await readFromApi<{
    unread: number;
    latest: NotificationItem[];
    messagesUnread: number;
    pendingSuggestions: number;
  }>(locals, actorId, `/v1/me/shell?${achievements(withAchievements)}`);
  return { ...shell, latest: reviveNotifications(shell.latest) };
}

/** The two numbers the page polls. */
export const readBadges = (locals: App.Locals, actorId: string, withAchievements: boolean) =>
  readFromApi<{ unread: number; messages: number }>(
    locals,
    actorId,
    `/v1/me/badges?${achievements(withAchievements)}`,
  );

/** A page of the notification feed; a page past the last is the page's 404. */
export async function readNotifications(
  locals: App.Locals,
  actorId: string,
  filter: { page: string | null; category?: string; unread: boolean; withAchievements: boolean },
) {
  const query = new URLSearchParams();
  if (filter.page !== null) query.set('page', filter.page);
  if (filter.category) query.set('category', filter.category);
  if (filter.unread) query.set('unread', '1');
  if (filter.withAchievements) query.set('achievements', '1');
  const feed = await readFromApi<{
    items: NotificationItem[];
    page: number;
    pages: number;
    unreadTotal: number;
  }>(locals, actorId, `/v1/me/notifications?${query}`);
  return { ...feed, items: reviveNotifications(feed.items) };
}
