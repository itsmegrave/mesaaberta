export const scrubString = (text: string) =>
  text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(
      /\b(?:password|passwd|secret|token|session[_-]?id|authorization|cookie|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
      '[redacted]',
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]');

/** Which deployable wrote a log line or raised an error, so web, api, worker and mcp can be told apart. */
export type AppName = 'web' | 'api' | 'worker' | 'mcp';

// No free text or request payloads are forwarded. Who acted and on what is, as opaque ids only
// (`userId`, `resourceType`, `resourceId`), so a line can be traced to a person and a record.
// Add fields deliberately here.
const COUNTS = new Set([
  'schemaVersion',
  'status',
  'durationMs',
  'attempt',
  'retryInSeconds',
  'swept',
  'pruned',
  'expired',
  'chats',
  'announced',
  'discovered',
  'imported',
  'existing',
  'suppressed',
  'skipped',
  'tables',
  'players',
  'received',
  'acknowledged',
  'done',
  'retried',
  'failed',
  'delayed',
  'delaySeconds',
  'closed',
  'lifted',
  'reminded',
  'deliveries',
  'attempts',
  'retry',
]);
const LABELS = new Set([
  'event',
  'eventType',
  'handler',
  'outcome',
  'method',
  'service',
  'app',
  'environment',
  'release',
  'code',
  'errorType',
  'causeCode',
  'provider',
  'stage',
  'reason',
  'resourceType',
  'colo',
  // The MCP tool a call ran (`search_tables`), never its arguments.
  'tool',
]);
const IDS = new Set(['requestId', 'actionId', 'eventId', 'tableId', 'registrationId', 'userId']);
/**
 * Every field name a log line or issue tag can carry; any other is dropped. `error` is the logger's
 * own: it becomes `errorType`, `code` and `causeCode`.
 */
export const LOGGED_FIELDS: ReadonlySet<string> = new Set([
  ...COUNTS,
  ...LABELS,
  ...IDS,
  'resourceId',
  'route',
  'error',
]);
// A resource is named by its uuid or by its public handle (a table's slug, a profile's @username).
const RESOURCE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;

export function safeFields(
  fields: Record<string, unknown> = {},
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (COUNTS.has(key) && typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    if (LABELS.has(key) && typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value))
      safe[key] = value;
    if (
      IDS.has(key) &&
      typeof value === 'string' &&
      /^(?:[a-f0-9]{8}-[a-f0-9-]{27}|[a-f0-9]{16,32}(?:-[A-Z]{3})?)$/i.test(value)
    )
      safe[key] = value;
    if (key === 'resourceId' && typeof value === 'string' && RESOURCE_ID.test(value))
      safe[key] = value;
    // Route templates, never the requested pathname with user-controlled slugs: SvelteKit's
    // (`/t/[slug]`) and the api's (`/v1/tables/:slug`).
    if (key === 'route' && typeof value === 'string' && /^\/[a-zA-Z0-9/_[\]()=.:-]*$/.test(value))
      safe[key] = value;
  }
  return safe;
}
