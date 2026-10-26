/**
 * `LOCAL_ONLY=true` keeps a self-hosted stack on its own machine (Trello #271): the process refuses
 * to start when a setting points at an outside service, and any `fetch` to a public address fails.
 * The Docker stack sets it by default; set it to anything else to connect Resend, Sentry and the rest.
 */

/** Settings the server connects to: each must name a local or private host. */
const ADDRESS_KEYS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'API_URL',
  'MAILPIT_URL',
  'GROWTHBOOK_API_HOST',
] as const;

/** Settings that only turn an outside service on: each must be empty. */
const SERVICE_KEYS = [
  'RESEND_API_KEY',
  'SENTRY_DSN',
  'MIXPANEL_TOKEN',
  'GROWTHBOOK_CLIENT_KEY',
  'INSTAGRAM_APP_ID',
] as const;

type LocalOnlyEnv = Partial<Record<string, string | undefined>>;

const privateIpv4 = (host: string) => {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return null;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
};

/** A host on this machine or its private network: loopback, a private range or a Docker service name. */
export const isLocalHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host.includes(':')) return host === '::1' || /^f[cd]/.test(host);
  const ipv4 = privateIpv4(host);
  if (ipv4 !== null) return ipv4;
  return (
    !host.includes('.') ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  );
};

const hostOf = (value: string) => {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

/** What keeps this configuration from being local only, one line per setting; empty when it is. */
export const localOnlyProblems = (env: LocalOnlyEnv): string[] => [
  ...ADDRESS_KEYS.flatMap((key) => {
    const value = env[key];
    if (!value) return [];
    const host = hostOf(value);
    if (host === null) return [`${key} is not a URL`];
    return isLocalHost(host) ? [] : [`${key} points at ${host}`];
  }),
  ...SERVICE_KEYS.filter((key) => env[key]).map((key) => `${key} is set`),
];

const urlOf = (input: Parameters<typeof fetch>[0]) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** `fetch` that refuses any request to a host that is not local. */
export const localOnlyFetch =
  (base: typeof fetch): typeof fetch =>
  (input, init) => {
    const host = hostOf(urlOf(input));
    if (host !== null && !isLocalHost(host))
      return Promise.reject(new Error(`LOCAL_ONLY: refused a request to ${host}`));
    return base(input, init);
  };

/**
 * Applies `LOCAL_ONLY` to this process. Throws when the configuration reaches outside (the process
 * should not start), and otherwise swaps the global `fetch` for one that stays local. Does nothing,
 * and returns false, when `LOCAL_ONLY` is not `true`.
 */
export const enforceLocalOnly = (
  env: LocalOnlyEnv,
  target: { fetch: typeof fetch } = globalThis,
): boolean => {
  if (env.LOCAL_ONLY !== 'true') return false;
  const problems = localOnlyProblems(env);
  if (problems.length)
    throw new Error(
      `LOCAL_ONLY is on, but this configuration reaches outside the machine:\n- ${problems.join('\n- ')}\nClear these settings, or set LOCAL_ONLY=false to connect outside services.`,
    );
  target.fetch = localOnlyFetch(target.fetch.bind(target));
  return true;
};
