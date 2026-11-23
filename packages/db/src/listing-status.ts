// Statuses of the directory listings members send: partners, tools and places wait for an admin
// (`pending`), are shown once approved, and end `removed` (rejected, taken down or withdrawn).
// Crowdfunding campaigns need no approval: they are `listed` until removed.
export const LISTING_STATUSES = ['pending', 'approved', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const CROWDFUNDING_STATUSES = ['listed', 'removed'] as const;
export type CrowdfundingStatus = (typeof CROWDFUNDING_STATUSES)[number];
