/** Public web routes are stable across languages. API and admin paths are separate contracts. */
export const routes = {
  tables: '/t',
  partners: '/p',
  crowdfunding: '/cf',
  messages: '/m',
  notifications: '/n',
  myTables: '/u/tables',
  calendar: '/u/tables/calendar',
  editProfile: '/u/profile/edit',
  export: '/u/profile/export',
  setup: '/u/profile/setup',
  table: (slug: string) => `/t/${encodeURIComponent(slug)}`,
  conversation: (id: string) => `/m/${encodeURIComponent(id)}`,
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
} as const;

/** Most specific entries first; suffixes (including deep resource links) stay intact. */
export const LEGACY_ROUTES = [
  ['/account/tables', routes.myTables],
  ['/account/profile', routes.editProfile],
  ['/account/connect', '/u/profile/connect'],
  ['/account/export', routes.export],
  ['/tables', routes.tables],
  ['/partners', routes.partners],
  ['/crowdfunding', routes.crowdfunding],
  ['/messages', routes.messages],
  ['/notifications', routes.notifications],
  ['/onboarding', routes.setup],
  ['/forgot-password', '/forgot'],
  ['/reset-password', '/reset'],
] as const;

// Previously advertised locale prefixes remain aliases, never a requirement for new links.
const LEGACY_LOCALE = /^\/(?:en|pt-BR)(?=\/|$)/;

export function canonicalPath(pathname: string): string {
  const unprefixed = pathname.replace(LEGACY_LOCALE, '') || '/';
  // Never turn a malformed prefixed path into a protocol-relative redirect.
  const path = unprefixed.startsWith('//') ? pathname : unprefixed;
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
