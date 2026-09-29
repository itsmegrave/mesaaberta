import { z } from 'zod';
import '$lib/forms/zod-codes';
import { imageFile } from '$lib/forms/files';
import { WELCOME_MESSAGE_MAX, cleanWelcomeMessage } from './welcome';
import { normalizeCep } from '$lib/location/cep';
import { isTimeZone } from '$lib/time/timezone';

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
  // Typed in hours, in half-hour steps; stored in minutes (game_tables.duration_minutes).
  durationHours: { min: 0.5, max: 24, step: 0.5 },
} as const;

/** True when `iso` is a calendar moment that exists (not `2026-13-40`), read as UTC. */
const isRealMoment = (iso: string, echo: string) => {
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(echo);
};

/** `2026-10-10T19:00`, and a moment that exists on the calendar. */
const isLocalDateTime = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && isRealMoment(`${value}:00Z`, value);

const isLocalDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && isRealMoment(`${value}T00:00:00Z`, value);

const text = (max: number) => z.string().trim().max(max);
const whole = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const RULES = { weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2' } as const;

export const tableFormSchema = z
  .object({
    systemSlug: z.string().trim().min(1),
    // Checked here so the form refuses it before uploading; the server still reads its bytes.
    image: imageFile,
    title: z.string().trim().min(TABLE_LIMITS.title.min).max(TABLE_LIMITS.title.max),
    description: text(TABLE_LIMITS.description).default(''),
    extraInfo: text(TABLE_LIMITS.extraInfo).default(''),
    welcomeMessage: z
      .string()
      .transform(cleanWelcomeMessage)
      .pipe(z.string().max(TABLE_LIMITS.welcomeMessage))
      .default(''),
    kind: z.enum(['campaign', 'one_shot']),
    capacity: whole(TABLE_LIMITS.capacity.min, TABLE_LIMITS.capacity.max),
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
    joinDetails: text(TABLE_LIMITS.joinDetails).default(''),
    // Checkboxes: every ticked one arrives under the same name. The server checks them against the catalog.
    platforms: z.array(z.string().trim().min(1)).max(TABLE_LIMITS.catalogPicks).default([]),
    tags: z.array(z.string().trim().min(1)).max(TABLE_LIMITS.catalogPicks).default([]),
    postalCode: z
      .string()
      .trim()
      .refine((value) => value === '' || normalizeCep(value) !== null, 'invalid')
      .default(''),
  })
  .superRefine((value, ctx) => {
    // With a CEP the server fills the area in; without one, the person types it.
    if (value.modality === 'in_person' && !value.locationArea && !value.postalCode) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['locationArea'] });
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
  kind: 'campaign' | 'one_shot';
  capacity: number;
  /** Wall-clock time in `timezone`, e.g. `2026-10-10T19:00`. */
  startsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  /** An iCalendar RRULE for a campaign, null for a one-shot. */
  recurrence: string | null;
  /** Last day of a campaign, as `YYYY-MM-DD` in `timezone`. */
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
    ...rest
  } = values;
  const campaign = rest.kind === 'campaign';
  const inPerson = rest.modality === 'in_person';

  return {
    ...rest,
    durationMinutes: Math.round(durationHours * 60),
    locationArea: inPerson ? locationArea || null : null,
    postalCode: inPerson ? normalizeCep(postalCode) : null,
    locationNeighbourhood: null,
    locationCity: null,
    locationState: null,
    joinDetails: joinDetails || null,
    extraInfo: extraInfo || null,
    welcomeMessage: welcomeMessage || null,
    recurrence: campaign ? RULES[repeat as keyof typeof RULES] : null,
    untilLocalDate: campaign && until ? until : null,
  };
}
