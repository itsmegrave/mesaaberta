import { z } from 'zod';

/**
 * Who looks after a partner: up to MAX_PARTNER_OWNERS member accounts, all equal. An owner invites
 * another account by its @username; the invite counts against the limit while it waits, and lapses
 * after PARTNER_INVITATION_DAYS.
 */
export const MAX_PARTNER_OWNERS = 5;
export const PARTNER_INVITATION_DAYS = 7;

/** "Convidar pelo @usuário". The service looks the name up; this only shapes it. */
export const partnerInviteSchema = z.object({
  username: z
    .string()
    .trim()
    .transform((name) => name.replace(/^@/, '').toLowerCase())
    .pipe(z.string().min(1, 'required').max(64, 'unavailable')),
});

/** One owner or one invitation, from the "Quem cuida" menus. */
export const partnerOwnerSchema = z.object({ profileId: z.uuid() });
export const partnerInvitationIdSchema = z.object({ invitationId: z.uuid() });
