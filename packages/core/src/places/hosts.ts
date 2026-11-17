import { z } from 'zod';
import { partnerInviteSchema } from '../partners/owners';

/**
 * "Quem mestra na casa": up to MAX_PLACE_HOSTS people a place names as its house GMs. Whoever owns
 * the place invites by @username; the invite counts against the limit while it waits, and lapses
 * after PLACE_HOST_INVITATION_DAYS.
 */
export const MAX_PLACE_HOSTS = 10;
export const PLACE_HOST_INVITATION_DAYS = 7;

/** "Convidar pelo @usuário": the same shape as a partner's invite. */
export const placeHostInviteSchema = partnerInviteSchema;
/** One house GM, or one invite, from the section's buttons. */
export const placeHostSchema = z.object({ profileId: z.uuid() });
export const placeHostInvitationIdSchema = z.object({ invitationId: z.uuid() });
/** Leaving a place from one's own profile. */
export const placeHostLeaveSchema = z.object({ placeId: z.uuid() });
