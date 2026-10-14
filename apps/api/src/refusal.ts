import type { Context } from 'hono';
import {
  AlreadyRegistered,
  DirectMessagesOff,
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableFull,
} from '@mesaaberta/core/server/errors';

/**
 * A domain refusal as the JSON the web Worker turns back into the same error, so a form shows what
 * it always showed. Null for anything that is not a refusal: a bug, which the caller rethrows.
 */
export function refusal(c: Context, error: unknown) {
  if (error instanceof Invalid)
    return c.json({ error: 'invalid', field: error.field, message: error.message }, 400);
  if (error instanceof RateLimited)
    return c.json({ error: 'rate_limited', retryAfter: error.retryAfterSeconds }, 429);
  if (error instanceof Forbidden) return c.json({ error: 'forbidden' }, 403);
  if (error instanceof NotFound) return c.json({ error: 'not_found' }, 404);
  if (error instanceof TableFull) return c.json({ error: 'table_full' }, 409);
  if (error instanceof AlreadyRegistered) return c.json({ error: 'already_registered' }, 409);
  if (error instanceof DirectMessagesOff) return c.json({ error: 'direct_messages_off' }, 409);
  return null;
}
