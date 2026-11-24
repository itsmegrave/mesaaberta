/**
 * postgres.js codes for a connection that went away under a query (Hyperdrive or the pooler closed
 * it, or it never came up). The query never ran to an answer, so a read can simply be sent again.
 */
const CONNECTION_LOST = new Set([
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  'CONNECT_TIMEOUT',
  'ECONNRESET',
]);

/** Whether an error (or the error drizzle wrapped, its `cause`) is a dropped database connection. */
export function isConnectionLost(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && CONNECTION_LOST.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
