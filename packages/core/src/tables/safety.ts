// What a table says about safety and content (`use_table_safety`): the tools its GM uses and an
// age rating in the ClassInd style. Shared by the form, the page, the list filter and the server.

/** The safety tools a GM can mark, in the order the form and the page show them. */
export const SAFETY_TOOLS = [
  'session_zero',
  'lines_veils',
  'x_card',
  'open_door',
  'stars_wishes',
] as const;
export type SafetyTool = (typeof SAFETY_TOOLS)[number];

/** The content ratings, youngest first. Mirrors the `game_tables_content_rating_value` check. */
export const CONTENT_RATINGS = ['L', '10', '12', '14', '16', '18'] as const;
export type ContentRating = (typeof CONTENT_RATINGS)[number];

export const isSafetyTool = (value: string): value is SafetyTool =>
  (SAFETY_TOOLS as readonly string[]).includes(value);
export const isContentRating = (value: string): value is ContentRating =>
  (CONTENT_RATINGS as readonly string[]).includes(value);

/** The picked tools, known ones only, once each, in the catalogue's order. */
export const orderedSafetyTools = (picked: readonly string[]): SafetyTool[] =>
  SAFETY_TOOLS.filter((tool) => picked.includes(tool));
