// Shared with the router (a param matcher runs in the browser too), so it must not import anything
// from `$lib/server`.
export const providers = ['google', 'discord', 'github'] as const;
export type Provider = (typeof providers)[number];
