import '$lib/forms/zod-codes';
import { z } from 'zod';
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_ICONS, ANNOUNCEMENT_TONES } from './kinds';

// Shared by the admin console's form (which shows the limits) and its action (which decides).
z.config({ jitless: true });

export const ANNOUNCEMENT_LIMITS = { title: 100, body: 500, link: 300, recipient: 80 } as const;

/**
 * A link the bell can follow: a path on this site. The bell sends people there with a redirect,
 * which only follows on-site paths, so anything else would be dropped when someone opens it.
 */
export const isSitePath = (value: string) =>
  value.startsWith('/') && !value.startsWith('//') && !/[\s\\]/.test(value);

export const announcementSchema = z
  .object({
    title: z.string().trim().min(1).max(ANNOUNCEMENT_LIMITS.title),
    body: z.string().trim().min(1).max(ANNOUNCEMENT_LIMITS.body),
    // Empty: the tone's icon.
    icon: z.union([z.enum(ANNOUNCEMENT_ICONS), z.literal('')]).default(''),
    tone: z.enum(ANNOUNCEMENT_TONES).default('info'),
    audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('all_active_users'),
    // A username (with or without @) or a user id; only read for `specific_user`.
    recipient: z.string().trim().max(ANNOUNCEMENT_LIMITS.recipient).default(''),
    link: z
      .string()
      .trim()
      .max(ANNOUNCEMENT_LIMITS.link)
      .refine((value) => value === '' || isSitePath(value), 'not_site_path')
      .default(''),
    // The second step: the first post only counts the audience and asks to confirm.
    confirmed: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.audience === 'specific_user' && !value.recipient) {
      context.addIssue({ code: 'custom', path: ['recipient'], message: 'required' });
    }
  });

export type AnnouncementInput = z.infer<typeof announcementSchema>;
