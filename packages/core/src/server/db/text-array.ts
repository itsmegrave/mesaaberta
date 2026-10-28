import { parsePgArray } from 'drizzle-orm/pg-core';

/**
 * Reads an SQL array that a raw `sql` field selects. The client skips `fetch_types`, so postgres.js
 * hands such an array over as its text (`{a,b}`); typed array columns are parsed by Drizzle, raw
 * fields are not. Use it as `sql<string[]>`…`.mapWith(textArray)`.
 */
export const textArray = (value: unknown): string[] =>
  Array.isArray(value) ? value : typeof value === 'string' ? parsePgArray(value) : [];
