/**
 * The names of the groups of people an extension can aim something at (a poll), without the
 * queries: the MCP and the forms validate with them. What each one means is in
 * `server/audience/segments.ts`.
 */
export const SEGMENTS = ['admin', 'gm', 'player', 'recent', 'new'] as const;
export type Segment = (typeof SEGMENTS)[number];
