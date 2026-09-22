import { z } from 'zod';
import '$lib/forms/zod-codes';
import { WELCOME_MESSAGE_MAX, cleanWelcomeMessage } from './welcome';

// Shared by the server (which decides) and the form (which could show the same limits).
// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

export const TABLE_LIMITS = {
	title: { min: 3, max: 80 },
	description: 4000,
	extraInfo: 2000,
	welcomeMessage: WELCOME_MESSAGE_MAX,
	capacity: { min: 1, max: 30 },
	durationMinutes: { min: 15, max: 1440 }
} as const;

const isRealTimezone = (timeZone: string) => {
	try {
		new Intl.DateTimeFormat('en', { timeZone });
		return true;
	} catch {
		return false;
	}
};

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
		timezone: z.string().refine(isRealTimezone, 'invalid'),
		durationMinutes: whole(TABLE_LIMITS.durationMinutes.min, TABLE_LIMITS.durationMinutes.max),
		repeat: z.string().default(''),
		until: z.string().default(''),
		joinMode: z.enum(['auto', 'approval']).default('auto')
	})
	.superRefine((value, ctx) => {
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
};

/** The validated form as what the domain wants: a repeat rule instead of a word, no empty strings. */
export function toTableInput(values: z.output<typeof tableFormSchema>): TableInput {
	const { repeat, until, extraInfo, welcomeMessage, ...rest } = values;
	const campaign = rest.kind === 'campaign';

	return {
		...rest,
		extraInfo: extraInfo || null,
		welcomeMessage: welcomeMessage || null,
		recurrence: campaign ? RULES[repeat as keyof typeof RULES] : null,
		untilLocalDate: campaign && until ? until : null
	};
}
