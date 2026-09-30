/** The header's two numbers: unread notifications and conversations with something unread. */
export const BADGES_KEY = ['badges'] as const;

export type Badges = { unread: number; messages: number };
