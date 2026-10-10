export const PROFILE_STATUSES = ['active', 'suspended'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];
