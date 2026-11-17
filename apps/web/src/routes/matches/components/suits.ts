import {
  leaning,
  MATCH_AXES,
  type MatchAxes,
  type MatchPole,
} from '@mesaaberta/core/matches/schema';
import { m } from '#lib/paraglide/messages.js';

/**
 * The eight "naipes", one per pole of the four play-style axes, drawn as 24px stroke paths (the
 * layout canvas, board 21.5). Illustration geometry, so the coordinates are as drawn.
 */
export const SUIT_PATHS: Record<MatchPole, string[]> = {
  combate: [
    'M4 4h2.5l9 9',
    'M4 4v2.5l9 9',
    'M12 17l5-5',
    'M15.5 15.5l4 4',
    'M20 4h-2.5l-9 9',
    'M20 4v2.5l-9 9',
    'M12 17l-5-5',
    'M8.5 15.5l-4 4',
  ],
  interpretacao: [
    'M3 4.5h11v5.5a5.5 5.5 0 0 1-11 0z',
    'M6.2 8.2h.01M10.8 8.2h.01',
    'M6.5 11.5c1.1 1 2.9 1 4 0',
    'M14 8.5h7V14a5.5 5.5 0 0 1-8.6 4.5',
    'M16.2 12.2h.01M19 12.2h.01',
    'M16 16.2c.9-.8 2.3-.8 3.2 0',
  ],
  regras: [
    'M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z',
    'M12 7.5l4.3 7.5H7.7z',
    'M12 2.5v5M3.5 7.5l4.2 7.5M20.5 7.5l-4.2 7.5M7.7 15L12 21.5l4.3-6.5',
  ],
  narrativa: [
    'M20.5 3.5C13 4 8 8.5 6 16l-1.5 4.5',
    'M20.5 3.5c-.5 7-5 11.5-12 12.5',
    'M9.5 10.5h6',
    'M4 21h9',
  ],
  campanha: ['M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z', 'M9 4v13.5M15 6.5V20'],
  oneshot: ['M13.5 2.5L4.5 14h7l-1 7.5 9-11.5h-7z'],
  sombrio: [
    'M12 3a7.5 7.5 0 0 0-4.5 13.5V20h9v-3.5A7.5 7.5 0 0 0 12 3z',
    'M9.2 9.9a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2z',
    'M14.8 9.9a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2z',
    'M10.5 20v-2M13.5 20v-2',
  ],
  leve: [
    'M12 1.5l2 4.6 4.6-2-1.4 4.8 4.8 1.6-4.1 2.9 3 4-5-.3-.7 5-3.2-3.8L8.8 22l-.7-5-5 .3 3-4L2 10.4l4.8-1.6-1.4-4.8 4.6 2z',
    'M12 8.8a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4z',
  ],
};

export const poleName = (pole: MatchPole): string =>
  ({
    combate: m.match_pole_combate,
    interpretacao: m.match_pole_interpretacao,
    regras: m.match_pole_regras,
    narrativa: m.match_pole_narrativa,
    campanha: m.match_pole_campanha,
    oneshot: m.match_pole_oneshot,
    sombrio: m.match_pole_sombrio,
    leve: m.match_pole_leve,
  })[pole]();

export const axisQuestion = (axis: (typeof MATCH_AXES)[number]['key']): string =>
  ({
    combat: m.match_axis_combat,
    rules: m.match_axis_rules,
    length: m.match_axis_length,
    tone: m.match_axis_tone,
  })[axis]();

/** The four corner badges of a card, in the corners' order: top left, top right, bottom left, bottom right. */
export const cornersOf = (axes: MatchAxes) =>
  MATCH_AXES.map(({ key }) => ({ key, ...leaning(key, axes[key]) }));
