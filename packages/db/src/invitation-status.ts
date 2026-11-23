// What became of an invitation (to a table, to co-own a partner, to host a place): waiting on the
// person invited, then answered, expired or called off. The three invitation tables share it.
export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];
