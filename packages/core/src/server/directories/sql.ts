import { and, isNull, notInArray, sql } from 'drizzle-orm';
import { gameTables, profiles } from '../db/schema';

// The SQL the public directories share (`/systems`, `/gamemasters`).

// What the database folds before comparing, the same letters `foldText` strips in JS.
const ACCENTED = 'áàâãäåéèêëíìîïóòôõöúùûüçñý';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuucny';
export const folded = (column: unknown) => sql`translate(lower(${column}), ${ACCENTED}, ${PLAIN})`;
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// A table counts once it is public: never a draft, and never one closed or taken down by the
// moderation (`disabled`).
export const published = and(
  notInArray(gameTables.status, ['draft', 'disabled']),
  isNull(gameTables.moderatedAt),
);
// Open is what /tables lists: active and not started yet.
export const openSql = (now: Date) =>
  sql`${gameTables.status} = 'active' and ${gameTables.startsAt} > ${now.toISOString()}::timestamptz`;
// Quem mestra counts people who can still be found: a banned account is left out.
export const activeGm = sql`${profiles.status} = 'active'`;
