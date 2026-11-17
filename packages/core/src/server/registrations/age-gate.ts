import { eq } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { isAdultRange } from '@mesaaberta/core/matches/schema';

/**
 * Whether a person who has not declared an adult age range is trying to take a place at a table rated 18. A
 * seat there opens the table chat and direct messages with the GM, so every way into the table
 * (joining, a request the GM approves, the waiting list, an invitation) asks this first. The age
 * range is what the person declared; one who left it blank is treated as under 18 until they say
 * otherwise, as Combinar does.
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
  return !isAdultRange(player?.ageRange);
}
