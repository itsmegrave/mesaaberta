/**
 * The origins an extension's connection form posts to, added to the CSP `form-action`. Read by
 * `vite.config.ts`, so it names nothing but strings. The web half of `installed.ts`, with
 * `panels.ts`: a private build replaces this file too. Instagram's OAuth starts at its own origin.
 */
export const formActionOrigins: readonly `https://${string}.${string}`[] = [
  'https://www.instagram.com',
];
