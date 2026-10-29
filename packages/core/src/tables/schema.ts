import { z } from 'zod';
import '@mesaaberta/core/forms/zod-codes';
import { imageFile } from '@mesaaberta/core/forms/files';
import { WELCOME_MESSAGE_MAX, cleanWelcomeMessage } from '@mesaaberta/core/tables/welcome';
import { richText } from '../text/rich-schema';
import { normalizeCep } from '../location/cep';
import { isTimeZone } from '../time/timezone';
import {
  CONTENT_RATINGS,
  SAFETY_TOOLS,
  orderedSafetyTools,
  type ContentRating,
  type SafetyTool,
} from './safety';

// Shared by the server (which decides) and the form (which could show the same limits).
// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

export const TABLE_LIMITS = {
  title: { min: 3, max: 80 },
  description: 4000,
  extraInfo: 2000,
  welcomeMessage: WELCOME_MESSAGE_MAX,
  capacity: { min: 1, max: 30 },
  // Mirror the length checks on game_tables.
  locationArea: 120,
  // Platforms or tags a table can pick, each.
  catalogPicks: 12,
  joinDetails: 1000,
  // An adventure's planned sessions (game_tables.planned_sessions).
  plannedSessions: { min: 2, max: 20 },
  // Typed in hours, in half-hour steps; stored in minutes (game_tables.duration_minutes).
  durationHours: { min: 0.5, max: 24, step: 0.5 },
} as const;

/** True when `iso` is a calendar moment that exists (not `2026-13-40`), read as UTC. */
const isRealMoment = (iso: string, echo: string) => {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(echo);
};

/** `2026-10-10T19:00`, and a moment that exists on the calendar. */
export const isLocalDateTime = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && isRealMoment(`${value}:00Z`, value);

const isLocalDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && isRealMoment(`${value}T00:00:00Z`, value);

/** Blank, or a whole number from 1 up to the largest table. */
const isMinPlayers = (value: string) =>
  value === '' ||
  (/^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= TABLE_LIMITS.capacity.max);

/** Blank, or a whole number of sessions an adventure can plan. */
const isPlannedSessions = (value: string) =>
  value === '' ||
  (/^\d{1,2}$/.test(value) &&
    Number(value) >= TABLE_LIMITS.plannedSessions.min &&
    Number(value) <= TABLE_LIMITS.plannedSessions.max);

const text = (max: number) => z.string().trim().max(max);
const whole = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const RULES = { weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2' } as const;

export const tableFormSchema = z
  .object({
    systemSlug: z.string().trim().min(1),
    // Checked here so the form refuses it before uploading; the server still reads its bytes.
    image: imageFile,
    title: z.string().trim().min(TABLE_LIMITS.title.min).max(TABLE_LIMITS.title.max),
    // Rich text: stored as the small HTML subset of `#lib/text/rich`, limited by what a reader sees.
    description: richText(TABLE_LIMITS.description).default(''),
    extraInfo: richText(TABLE_LIMITS.extraInfo).default(''),
    welcomeMessage: z
      .string()
      .transform(cleanWelcomeMessage)
      .pipe(richText(TABLE_LIMITS.welcomeMessage))
      .default(''),
    kind: z.enum(['campaign', 'one_shot', 'adventure']),
    capacity: whole(TABLE_LIMITS.capacity.min, TABLE_LIMITS.capacity.max),
    // Optional: blank means the table has no minimum. A text field, like the CEP, so "empty" is not 0.
    minPlayers: z.string().trim().refine(isMinPlayers, 'invalid').default(''),
    // Required on an adventure, ignored on the other kinds. Text, like `minPlayers`.
    plannedSessions: z.string().trim().refine(isPlannedSessions, 'invalid').default(''),
    startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
    timezone: z.string().refine(isTimeZone, 'invalid'),
    durationHours: z.coerce
      .number()
      .min(TABLE_LIMITS.durationHours.min)
      .max(TABLE_LIMITS.durationHours.max)
      .multipleOf(TABLE_LIMITS.durationHours.step),
    repeat: z.string().default(''),
    until: z.string().default(''),
    joinMode: z.enum(['auto', 'approval']).default('auto'),
    modality: z.enum(['online', 'in_person']).default('online'),
    locationArea: text(TABLE_LIMITS.locationArea).default(''),
    joinDetails: richText(TABLE_LIMITS.joinDetails).default(''),
    // Checkboxes: every ticked one arrives under the same name. The server checks them against the catalog.
    platforms: z.array(z.string().trim().min(1)).max(TABLE_LIMITS.catalogPicks).default([]),
    tags: z.array(z.string().trim().min(1)).max(TABLE_LIMITS.catalogPicks).default([]),
    postalCode: z
      .string()
      .trim()
      .refine((value) => value === '' || normalizeCep(value) !== null, 'invalid')
      .default(''),
    // An "Onde jogar" place picked for an in-person table (its slug), or blank for "Outro lugar".
    placeSlug: z.string().trim().max(200).default(''),
    // Checkboxes, like the platforms; unknown keys are refused.
    safetyTools: z.array(z.enum(SAFETY_TOOLS)).max(SAFETY_TOOLS.length).default([]),
    // Blank for "not said".
    contentRating: z.union([z.literal(''), z.enum(CONTENT_RATINGS)]).default(''),
    // Editing: take the current image off (a new image wins over it).
    removeImage: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // With a CEP the server fills the area in; without one, the person types it.
    if (
      value.modality === 'in_person' &&
      !value.placeSlug &&
      !value.locationArea &&
      !value.postalCode
    ) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['locationArea'] });
    }
    // The minimum cannot be more than the seats there are.
    if (value.minPlayers !== '' && Number(value.minPlayers) > value.capacity) {
      ctx.addIssue({ code: 'custom', message: 'above_capacity', path: ['minPlayers'] });
    }
    if (value.kind === 'adventure' && value.plannedSessions === '') {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['plannedSessions'] });
    }
    if (value.kind !== 'campaign') return;

    if (!(value.repeat in RULES)) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['repeat'] });
    }
    if (value.until && !isLocalDate(value.until)) {
      ctx.addIssue({ code: 'custom', message: 'invalid', path: ['until'] });
    } else if (value.until && value.until < value.startsAtLocal.slice(0, 10)) {
      ctx.addIssue({ code: 'custom', message: 'before_start', path: ['until'] });
    }
  });

export type TableInput = {
  systemSlug: string;
  title: string;
  description: string;
  extraInfo: string | null;
  welcomeMessage: string | null;
  kind: 'campaign' | 'one_shot' | 'adventure';
  capacity: number;
  /** The fewest players the GM wants, or null for no minimum. */
  minPlayers: number | null;
  /** How many sessions an adventure plans; null for the other kinds. */
  plannedSessions: number | null;
  /** Wall-clock time in `timezone`, e.g. `2026-10-10T19:00`. */
  startsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  /** An iCalendar RRULE for a repeating campaign, null otherwise. */
  recurrence: string | null;
  /** Last day of a repeating campaign, as `YYYY-MM-DD` in `timezone`. */
  untilLocalDate: string | null;
  joinMode: 'auto' | 'approval';
  modality: 'online' | 'in_person';
  /** Neighbourhood and city of an in-person table; public. Null online. */
  locationArea: string | null;
  /** How to join (link or address); private to the GM and the confirmed players. */
  joinDetails: string | null;
  /** Catalog slugs, in the order picked. */
  platforms: string[];
  tags: string[];
  /** The CEP of an in-person table, 8 digits; null without one or online. */
  postalCode: string | null;
  /** What the CEP resolved to (see `withLocation`); null until then, or when it could not be looked up. */
  locationNeighbourhood: string | null;
  locationCity: string | null;
  locationState: string | null;
  /**
   * The "Onde jogar" place an in-person table happens at (see `withPlace`), whose CEP and area it
   * copies; null for "Outro lugar" and online.
   */
  placeId?: string | null;
  /** Keys of `SAFETY_TOOLS`, in its order. */
  safetyTools?: SafetyTool[];
  /** ClassInd-style rating, or null when not said. */
  contentRating?: ContentRating | null;
  /** Editing: take the current image off, unless a new one is sent. */
  removeImage: boolean;
};

/** The validated form as what the domain wants: a repeat rule instead of a word, no empty strings. */
export function toTableInput(values: z.output<typeof tableFormSchema>): TableInput {
  const {
    // The image is stored by the action, never saved as a column.
    image: _image,
    durationHours,
    repeat,
    until,
    extraInfo,
    welcomeMessage,
    locationArea,
    joinDetails,
    postalCode,
    minPlayers,
    plannedSessions,
    // Resolved to `placeId` on the server (`withPlace`), never stored as such.
    placeSlug: _placeSlug,
    safetyTools,
    contentRating,
    ...rest
  } = values;
  const campaign = rest.kind === 'campaign';
  const inPerson = rest.modality === 'in_person';

  return {
    ...rest,
    minPlayers: minPlayers === '' ? null : Number(minPlayers),
    plannedSessions:
      rest.kind === 'adventure' && plannedSessions !== '' ? Number(plannedSessions) : null,
    durationMinutes: Math.round(durationHours * 60),
    locationArea: inPerson ? locationArea || null : null,
    postalCode: inPerson ? normalizeCep(postalCode) : null,
    locationNeighbourhood: null,
    locationCity: null,
    locationState: null,
    placeId: null,
    joinDetails: joinDetails || null,
    extraInfo: extraInfo || null,
    welcomeMessage: welcomeMessage || null,
    recurrence: campaign ? RULES[repeat as keyof typeof RULES] : null,
    untilLocalDate: campaign && until ? until : null,
    safetyTools: orderedSafetyTools(safetyTools),
    contentRating: contentRating || null,
  };
}

const nullable = (max: number) => z.string().max(max).nullable();

/**
 * A `TableInput` as the api Worker receives it: what the web form action already validated with
 * `tableFormSchema` and resolved (`toTableInput`, `withLocation`), checked again for shape and
 * limits so the api never trusts the sender's validation.
 */
export const tableInputSchema = z.object({
  systemSlug: z.string().min(1).max(200),
  title: z.string().min(TABLE_LIMITS.title.min).max(TABLE_LIMITS.title.max),
  description: z.string().max(20_000),
  extraInfo: nullable(20_000),
  welcomeMessage: nullable(20_000),
  kind: z.enum(['campaign', 'one_shot', 'adventure']),
  capacity: z.number().int().min(TABLE_LIMITS.capacity.min).max(TABLE_LIMITS.capacity.max),
  minPlayers: z.number().int().min(1).max(TABLE_LIMITS.capacity.max).nullable(),
  // Defaults to null so a web Worker that does not send it yet still passes.
  plannedSessions: z
    .number()
    .int()
    .min(TABLE_LIMITS.plannedSessions.min)
    .max(TABLE_LIMITS.plannedSessions.max)
    .nullable()
    .default(null),
  startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
  timezone: z.string().refine(isTimeZone, 'invalid'),
  durationMinutes: z
    .number()
    .int()
    .min(TABLE_LIMITS.durationHours.min * 60)
    .max(TABLE_LIMITS.durationHours.max * 60),
  recurrence: z.enum([RULES.weekly, RULES.biweekly]).nullable(),
  untilLocalDate: z.string().refine(isLocalDate, 'invalid').nullable(),
  joinMode: z.enum(['auto', 'approval']),
  modality: z.enum(['online', 'in_person']),
  locationArea: nullable(TABLE_LIMITS.locationArea),
  joinDetails: nullable(20_000),
  platforms: z.array(z.string().min(1).max(200)).max(TABLE_LIMITS.catalogPicks),
  tags: z.array(z.string().min(1).max(200)).max(TABLE_LIMITS.catalogPicks),
  postalCode: nullable(8),
  locationNeighbourhood: nullable(200),
  locationCity: nullable(200),
  locationState: nullable(100),
  // Defaults to null so a web Worker that does not send it yet still passes.
  placeId: z.uuid().nullable().default(null),
  // Default to none so a web Worker that does not send them yet still passes.
  safetyTools: z.array(z.enum(SAFETY_TOOLS)).max(SAFETY_TOOLS.length).default([]),
  contentRating: z.enum(CONTENT_RATINGS).nullable().default(null),
  removeImage: z.boolean(),
}) satisfies z.ZodType<TableInput>;
