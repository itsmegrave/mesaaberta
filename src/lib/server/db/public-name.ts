import { sql, type AnyColumn } from 'drizzle-orm';

/** What is shown for someone who has not picked a username yet (a profile older than the onboarding step). */
export const NAMELESS = 'jogador';

/** The public name of a profile: its username, or a placeholder while it has none. */
export const publicName = (username: AnyColumn) => sql<string>`coalesce(${username}, ${NAMELESS})`;
