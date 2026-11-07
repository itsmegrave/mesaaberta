import { z } from 'zod';
import '@mesaaberta/core/forms/zod-codes';
import { imageFile } from '@mesaaberta/core/forms/files';
import type { ReportReason } from '../moderation/reports';
import { parseSocialUrl } from '../profile/social-links';

// Zod's JIT uses `Function`, which strict CSP blocks (and reports even when Zod catches the error).
z.config({ jitless: true });

/** What a tool is, in the order the page groups them. Mirror the `tools_kind_known` check. */
export const TOOL_KINDS = ['vtt', 'chat', 'call', 'helper'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const isToolKind = (value: unknown): value is ToolKind =>
  typeof value === 'string' && (TOOL_KINDS as readonly string[]).includes(value);

/** The admin list's "Situação" filter. */
export const TOOL_ADMIN_STATUSES = ['all', 'pending', 'up', 'removed'] as const;
export type ToolAdminStatus = (typeof TOOL_ADMIN_STATUSES)[number];

/** Mirror the length checks on `tools`. */
export const TOOL_LIMITS = { name: 60, description: 140 } as const;

/** Why an admin turns a suggestion down or takes a tool off. */
export const TOOL_REMOVAL_REASONS = [
  'broken_link',
  'off_topic',
  'spam',
  'scam',
  'inappropriate_content',
  'other',
] as const satisfies readonly ReportReason[];
export type ToolRemovalReason = (typeof TOOL_REMOVAL_REASONS)[number];

/**
 * The site's address to store: the normalised link without the lone `/` of a bare domain (so
 * `discord.com` and `https://discord.com/` are the same site), or null when it is not one.
 */
export const toolSiteUrl = (raw: string) =>
  parseSocialUrl(raw)?.replace(/^(https?:\/\/[^/?#]+)\/$/, '$1') ?? null;

const fields = {
  name: z.string().trim().min(1, 'required').max(TOOL_LIMITS.name, 'too_long'),
  siteUrl: z
    .string()
    .trim()
    .min(1, 'required')
    .refine((value) => toolSiteUrl(value) !== null, 'invalid_url'),
  // Plain text in the form (nothing is picked at first); the service narrows it to a ToolKind.
  kind: z.string().refine((value): boolean => isToolKind(value), 'required'),
  description: z.string().trim().min(1, 'required').max(TOOL_LIMITS.description, 'too_long'),
};

/** What the service stores, without the logo file: the api checks the same fields again. */
export const toolInputSchema = z.object(fields);
export type ToolInput = z.output<typeof toolInputSchema>;

/** "Sugerir ferramenta" and the admin's "Editar": the logo is optional either way. */
export const toolFormSchema = z.object({ ...fields, logo: imageFile });

export const NEW_TOOL_VALUES = {
  name: '',
  siteUrl: '',
  kind: '',
  description: '',
  logo: undefined,
};

const uuid = z.uuid();

/** An admin action that names only the tool (approving a suggestion). */
export const toolIdSchema = z.object({ id: uuid });

/** An admin turning a suggestion down or taking a tool off: the reason and a note the submitter reads. */
export const TOOL_REMOVAL_NOTE_MAX = 1000;
export const removeToolSchema = z.object({
  id: uuid,
  reason: z.enum(TOOL_REMOVAL_REASONS),
  note: z.string().trim().max(TOOL_REMOVAL_NOTE_MAX),
});
