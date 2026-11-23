// Statuses of the rows an admin reviews: a system's logo (`system_logos`), a claim to run a place
// (`place_claims`) and a request to link a place to a partner (`place_partner_links`).
export const LOGO_STATUSES = ['pending', 'approved', 'rejected', 'missing'] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

export const PLACE_CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PlaceClaimStatus = (typeof PLACE_CLAIM_STATUSES)[number];

export const PARTNER_LINK_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'removed',
] as const;
export type PartnerLinkStatus = (typeof PARTNER_LINK_STATUSES)[number];
