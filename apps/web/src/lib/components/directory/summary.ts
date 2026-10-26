import { m } from '#lib/paraglide/messages.js';

/**
 * The first names of a folded section's list, for its summary: "Acessível, Empresta jogos e mais
 * 3". `total` counts everything the section holds, which may be more than the names given.
 */
export function namesSummary(names: readonly string[], total = names.length): string {
  const shown = names.slice(0, 2).join(', ');
  const rest = total - Math.min(names.length, 2);
  return rest > 0 ? m.directory_summary_more({ names: shown, count: rest }) : shown;
}
