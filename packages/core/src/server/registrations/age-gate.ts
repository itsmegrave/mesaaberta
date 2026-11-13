import { eq } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { profiles } from '@mesaaberta/core/server/db/schema';

/**
 * Whether a person who said they are 13 to 17 is trying to take a place at a table rated 18. A
 * seat there opens the table chat and direct messages with the GM, so every way into the table
 * (joining, a request the GM approves, the waiting list, an invitation) asks this first. The age
 * range is what the person declared; one who left it blank is not assumed to be a minor.
 */
export async function isMinorAtAdultTable(
  db: AnyDb,
  table: { contentRating: string | null },
  playerId: string,
): Promise<boolean> {
  if (table.contentRating !== '18') return false;
  const [player] = await db
    .select({ ageRange: profiles.ageRange })
    .from(profiles)
    .where(eq(profiles.id, playerId));
  return player?.ageRange === '13_17';
}
