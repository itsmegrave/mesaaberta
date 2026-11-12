import { z } from 'zod';

z.config({ jitless: true });

// Combinar (`/matches`), the "RPG tinder": an opt-in card, a deck of people whose cards fit, a yes
// or a no about each one, and a match when two people both said yes. Adults only.

/** What a person is after. Mirrors the `match_seeking` enum. */
export const MATCH_SEEKING = ['players', 'gm', 'group'] as const;
export type MatchSeeking = (typeof MATCH_SEEKING)[number];

/**
 * Whom each wish meets: people for my table meet people looking for a GM (and back), and forming a
 * group meets others forming one.
 */
export const SEEKING_MEETS: Record<MatchSeeking, MatchSeeking> = {
  players: 'gm',
  gm: 'players',
  group: 'group',
};

/**
 * The four play-style axes ("naipes"), each 0 to 100 towards its first pole; 50 is the middle. The
 * card's corners show the pole a person leans to, with a ring of 10 segments for how much. Mirror
 * the `axis_*` columns of `match_cards`.
 */
export const MATCH_AXES = [
  { key: 'combat', poles: ['combate', 'interpretacao'] },
  { key: 'rules', poles: ['regras', 'narrativa'] },
  { key: 'length', poles: ['campanha', 'oneshot'] },
  { key: 'tone', poles: ['sombrio', 'leve'] },
] as const;
export type MatchAxis = (typeof MATCH_AXES)[number]['key'];
export type MatchPole = (typeof MATCH_AXES)[number]['poles'][number];
export type MatchAxes = Record<MatchAxis, number>;

/** Where a value leans: the pole and how far (50 to 100), as a corner badge shows it. */
export function leaning(axis: MatchAxis, value: number): { pole: MatchPole; percent: number } {
  const [first, second] = MATCH_AXES.find((a) => a.key === axis)!.poles;
  return value >= 50
    ? { pole: first, percent: Math.round(value) }
    : { pole: second, percent: Math.round(100 - value) };
}

/** How many answers a person gives a day: a cap on sweeping through everyone. */
export const MATCH_DAILY_ANSWERS = 50;
/**
 * An answer, yes or no, takes the person out of the deck for this long; then they come back (a
 * reminder) if both cards still fit and no match was made. A yes keeps counting towards a match.
 */
export const MATCH_PASS_DAYS = 30;
/** Answers are deleted after this many days (the sweep); a match that came of one stays. */
export const MATCH_ANSWER_DAYS = 180;
/** How many cards one deck read brings. */
export const MATCH_DECK_SIZE = 20;
/** The matches list's page size. */
export const MATCHES_PAGE_SIZE = 20;
/** How many favorite systems a card names; the rest is a count. */
export const MATCH_CARD_SYSTEMS = 4;

/** The fit score's weights (0 to 100 in all): systems in common, free times in common, style. */
export const MATCH_WEIGHTS = { systems: 35, availability: 25, style: 40 } as const;
/** From this score a card says "Combina muito"; from the second, "Combina bem". */
export const MATCH_FIT = { great: 70, good: 45 } as const;
export type MatchFit = 'great' | 'good' | null;

export function fitOf(score: number): MatchFit {
  if (score >= MATCH_FIT.great) return 'great';
  if (score >= MATCH_FIT.good) return 'good';
  return null;
}

const axis = z.coerce.number().int().min(0).max(100);

/** The card as the setup saves it: on, with the adult confirmation, or off. */
export const matchCardSchema = z
  .object({
    enabled: z.boolean(),
    adult: z.boolean(),
    seeking: z.array(z.enum(MATCH_SEEKING)).max(3).default([]),
    online: z.boolean(),
    inPerson: z.boolean(),
    combat: axis.default(50),
    rules: axis.default(50),
    length: axis.default(50),
    tone: axis.default(50),
  })
  .superRefine((card, ctx) => {
    if (!card.enabled) return;
    if (!card.adult) ctx.addIssue({ code: 'custom', path: ['adult'], message: 'adult_required' });
    if (card.seeking.length === 0)
      ctx.addIssue({ code: 'custom', path: ['seeking'], message: 'seeking_required' });
    if (!card.online && !card.inPerson)
      ctx.addIssue({ code: 'custom', path: ['online'], message: 'format_required' });
  });
export type MatchCardInput = z.output<typeof matchCardSchema>;

/** A yes (Quero jogar junto) or a no (Agora não) about someone's card, by their @usuário. */
export const matchAnswerSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(60),
  yes: z.boolean(),
});
export type MatchAnswerInput = z.output<typeof matchAnswerSchema>;

/** Whether an age range lets someone use Combinar: declared, and 18 or older. */
export const isAdultRange = (ageRange: string | null | undefined) =>
  !!ageRange && ageRange !== '13_17';
