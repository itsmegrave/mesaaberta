import { z } from 'zod';
import '@mesaaberta/core/forms/zod-codes';
import { pageNumber } from '../admin/catalog';
import { PLACE_CLAIM_LIMITS } from './claims';

// A place that is also a partner: someone who looks after both asks, an admin decides. The forms
// here are shared by the place's edit page, the admin queue and their actions.

const uuid = z.uuid();

/** "Parceiro" on the place's edit page: which of the person's partners the place is. */
export const placePartnerRequestSchema = z.object({ partnerId: uuid });
/** Withdrawing the request that waits, or taking the link that is up down: nothing to fill in. */
export const placePartnerEndSchema = z.object({});
/** An admin approving or rejecting a request (with a note the requester reads). */
export const approvePartnerLinkSchema = z.object({ id: uuid });
export const rejectPartnerLinkSchema = z.object({
  id: uuid,
  note: z.string().trim().max(PLACE_CLAIM_LIMITS.decision),
});

/** "Mostrar meu perfil em Quem mestra" on a partner the person looks after. */
export const partnerShowAsGmSchema = z.object({ show: z.boolean() });
/** The same switch as the edit page posts it. */
export const partnerShowAsGmFormSchema = z.object({ show: z.enum(['true', 'false']) });

export const PARTNER_LINK_STATUSES = ['pending', 'approved', 'rejected', 'all'] as const;
export type PartnerLinkStatus = (typeof PARTNER_LINK_STATUSES)[number];

/** The filters of `/admin/places/links`: what waits, oldest first. */
export function partnerLinkFilters(params: URLSearchParams) {
  const status = params.get('status') ?? '';
  return {
    status: (PARTNER_LINK_STATUSES as readonly string[]).includes(status)
      ? (status as PartnerLinkStatus)
      : ('pending' as const),
    page: pageNumber(params.get('page')),
    pageSize: 20,
  };
}
