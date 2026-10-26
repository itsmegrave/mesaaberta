import { z } from 'zod';
import '@mesaaberta/core/forms/zod-codes';
import { pageNumber } from '../admin/catalog';

/** Who a claimant is at the place. */
export const PLACE_CLAIM_RELATIONS = ['owner', 'staff', 'organizer'] as const;
export type PlaceClaimRelation = (typeof PLACE_CLAIM_RELATIONS)[number];

export const PLACE_CLAIM_LIMITS = { contact: { min: 3, max: 120 }, note: 500, decision: 1000 };

const uuid = z.uuid();

/** "Este lugar é seu?": who they are there, how the team reaches them, and that they speak for it. */
export const placeClaimSchema = z.object({
  relation: z.enum(PLACE_CLAIM_RELATIONS),
  contact: z
    .string()
    .trim()
    .min(PLACE_CLAIM_LIMITS.contact.min)
    .max(PLACE_CLAIM_LIMITS.contact.max),
  note: z.string().trim().max(PLACE_CLAIM_LIMITS.note).default(''),
  confirm: z.literal(true),
});
export type PlaceClaimInput = z.output<typeof placeClaimSchema>;

/** An admin approving a claim: the claimant becomes the place's owner. */
export const approveClaimSchema = z.object({ id: uuid });
/** An admin turning a claim down, with a note the claimant reads. */
export const rejectClaimSchema = z.object({
  id: uuid,
  note: z.string().trim().max(PLACE_CLAIM_LIMITS.decision),
});
/** Taking a place's owner off: the owner hands it back, or an admin removes them. */
export const placeOwnerSchema = z.object({ id: uuid });

export const PLACE_CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'all'] as const;
export type PlaceClaimStatus = (typeof PLACE_CLAIM_STATUSES)[number];

/** The filters of `/admin/places/claims`: what waits, oldest first. */
export function placeClaimFilters(params: URLSearchParams) {
  const status = params.get('status') ?? '';
  return {
    status: (PLACE_CLAIM_STATUSES as readonly string[]).includes(status)
      ? (status as PlaceClaimStatus)
      : ('pending' as const),
    page: pageNumber(params.get('page')),
    pageSize: 20,
  };
}
