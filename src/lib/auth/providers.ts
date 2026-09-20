// Shared with the router (a param matcher runs in the browser too), so it must not import anything
// from `$lib/server`.
// Only the providers that are set up in Supabase: a button for one that is not would fail. To add
// one (Apple, Facebook, ...), enable it in Supabase, add it here and to the list on the login page.
export const providers = ['google', 'discord'] as const;
export type Provider = (typeof providers)[number];
