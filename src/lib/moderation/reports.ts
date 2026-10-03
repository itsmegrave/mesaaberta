import '$lib/forms/zod-codes';
import { z } from 'zod';

z.config({ jitless: true });

// Shared by the report forms and the server. Keep in step with the `report_*` enums and checks in
// src/lib/server/db/schema.ts.

export const REPORT_TARGETS = ['table', 'player'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate_content',
  'no_show',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// `open` and `reviewing` are still waiting on an admin; the other two are closed.
export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const OPEN_REPORT_STATUSES = [
  'open',
  'reviewing',
] as const satisfies readonly ReportStatus[];

/** Mirrors the `reports_details_length` and `reports_resolution_note_length` checks. */
export const REPORT_DETAILS_MAX = 1000;
export const RESOLUTION_NOTE_MAX = 1000;

const uuid = z.uuid();

/** What a member sends: the table it happened at, and the player when the report is about one. */
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  playerId: z.union([z.literal(''), uuid]),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX),
});
export type ReportInput = z.output<typeof reportSchema>;

/** An admin closing a report: accepted (`resolved`) or dismissed, with an optional note. */
export const closeReportSchema = z.object({
  id: uuid,
  note: z.string().trim().max(RESOLUTION_NOTE_MAX),
});

/** An admin action that names only the report. */
export const reportIdSchema = z.object({ id: uuid });

/** Closing a reported table: the justification is required, and only its GM reads it. */
export const closeTableSchema = z.object({
  id: uuid,
  note: z.string().trim().min(1).max(RESOLUTION_NOTE_MAX),
});

/** Closing a table from the tables list: the same justification, with no report behind it. */
export const closeTableByIdSchema = z.object({
  tableId: uuid,
  note: z.string().trim().min(1).max(RESOLUTION_NOTE_MAX),
});

/** How long a ban lasts: a number of days, or for good. */
export const BAN_DURATIONS = ['7', '30', '90', 'permanent'] as const;
export type BanDuration = (typeof BAN_DURATIONS)[number];

/** When a ban of `duration` that starts at `now` ends; null for a permanent one. */
export const banEnd = (duration: BanDuration, now: Date) =>
  duration === 'permanent' ? null : new Date(now.getTime() + Number(duration) * 86_400_000);

const ban = {
  duration: z.enum(BAN_DURATIONS),
  // What the person is told by e-mail.
  reason: z.string().trim().min(1).max(RESOLUTION_NOTE_MAX),
};

/** Banning the person a report is about (the reported player). */
export const banFromReportSchema = z.object({ id: uuid, ...ban });

/** Banning from the user's admin page. */
export const banSchema = z.object({ profileId: uuid, ...ban });

/** From how many accepted reports against the tables someone runs the admin is warned. */
export const TABLE_REPORTS_WARNING = 3;

/** Revoking a ban. */
export const accountSchema = z.object({ profileId: uuid });
