/**
 * Public web routes are stable across languages. API and admin paths are separate contracts. Lists
 * and forms are words (`/tables`, `/tables/new`); a single item keeps its letter (`/t/<slug>`).
 */
export const routes = {
  tables: '/tables',
  newTable: '/tables/new',
  partners: '/partners',
  crowdfunding: '/crowdfunding',
  messages: '/messages',
  notifications: '/notifications',
  myTables: '/u/tables',
  calendar: '/u/tables/calendar',
  editProfile: '/u/profile/edit',
  export: '/u/profile/export',
  setup: '/u/profile/setup',
  invitation: (id: string) => `/u/profile/invitations/${encodeURIComponent(id)}`,
  table: (slug: string) => `/t/${encodeURIComponent(slug)}`,
  conversation: (id: string) => `/m/${encodeURIComponent(id)}`,
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
} as const;

/** Pages whose address changed whole, matched exactly (2026-10-26: lists took words). */
export const LEGACY_PAGES: Readonly<Record<string, string>> = {
  '/t': routes.tables,
  '/t/new': routes.newTable,
  '/p': routes.partners,
  '/p/new': '/partners/new',
  '/m': routes.messages,
  '/n': routes.notifications,
};

/**
 * Most specific entries first; suffixes (including deep resource links) stay intact. A path that is
 * already canonical (`CANONICAL`) is never rewritten, so `/tables/new` does not become `/t/new`.
 */
export const LEGACY_ROUTES = [
  ['/account/tables', routes.myTables],
  ['/account/profile', routes.editProfile],
  ['/account/invitations', '/u/profile/invitations'],
  ['/account/connect', '/u/profile/connect'],
  ['/account/export', routes.export],
  // Crowdfunding has no item pages, so all of `/cf` moved.
  ['/cf', routes.crowdfunding],
  // The old long item addresses keep reaching their item under its letter.
  ['/tables', '/t'],
  ['/partners', '/p'],
  ['/messages', '/m'],
  ['/onboarding', routes.setup],
  ['/forgot-password', '/forgot'],
  ['/reset-password', '/reset'],
] as const;

/** The list and form pages under the words that `LEGACY_ROUTES` sends to the letters. */
const CANONICAL = new Set<string>([
  routes.tables,
  routes.newTable,
  routes.partners,
  '/partners/new',
  routes.messages,
]);

// Previously advertised locale prefixes remain aliases, never a requirement for new links.
const LEGACY_LOCALE = /^\/(?:en|pt-BR)(?=\/|$)/;

export function canonicalPath(pathname: string): string {
  const unprefixed = pathname.replace(LEGACY_LOCALE, '') || '/';
  // Never turn a malformed prefixed path into a protocol-relative redirect.
  const path = unprefixed.startsWith('//') ? pathname : unprefixed;
  if (CANONICAL.has(path)) return path;
  const page = LEGACY_PAGES[path];
  if (page) return page;
  for (const [legacy, canonical] of LEGACY_ROUTES) {
    if (path === legacy || path.startsWith(`${legacy}/`))
      return canonical + path.slice(legacy.length);
  }
  return path;
}

/** Mutations use the router alias and keep their body/method; only reads redirect. */
export function legacyRedirect(url: URL, method: string) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const pathname = canonicalPath(url.pathname);
  return pathname === url.pathname
    ? null
    : { status: 308 as const, location: pathname + url.search + url.hash };
}
