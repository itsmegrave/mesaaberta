import { m } from '#lib/paraglide/messages.js';
import type { ContentRating, SafetyTool } from '@mesaaberta/core/tables/safety';

/** What each safety tool is called on the form and the table page. */
export function safetyToolLabel(tool: SafetyTool): string {
  switch (tool) {
    case 'session_zero':
      return m.safety_tool_session_zero();
    case 'lines_veils':
      return m.safety_tool_lines_veils();
    case 'x_card':
      return m.safety_tool_x_card();
    case 'open_door':
      return m.safety_tool_open_door();
    case 'stars_wishes':
      return m.safety_tool_stars_wishes();
  }
}

/** "Livre" or "14+", as ClassInd writes it. */
export const contentRatingLabel = (rating: ContentRating): string =>
  rating === 'L' ? m.content_rating_free() : m.content_rating_age({ age: rating });

/** "Livre" or "Não recomendado para menores de 14 anos": the rating in ClassInd's own words. */
export const contentRatingLongLabel = (rating: ContentRating): string =>
  rating === 'L' ? m.content_rating_free() : m.content_rating_long_age({ age: rating });
