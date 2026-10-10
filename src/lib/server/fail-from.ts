import { fail } from '@sveltejs/kit';
import {
  AlreadyRated,
  AlreadyRegistered,
  DirectMessagesOff,
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableFull,
  TooEarly,
} from './errors';

/**
 * The one place a domain error becomes a form failure. Use it in a form action's `catch`:
 * `catch (error) { return failFrom(error); }`. Anything that is not a domain error is a bug, so it
 * is rethrown and becomes a 500 rather than a misleading 403.
 */
export function failFrom(error: unknown) {
  if (error instanceof Forbidden) return fail(403, { error: 'forbidden' as const });
  if (error instanceof NotFound) return fail(404, { error: 'not_found' as const });
  if (error instanceof TableFull) return fail(409, { error: 'table_full' as const });
  if (error instanceof TooEarly) return fail(409, { error: 'too_early' as const });
  if (error instanceof AlreadyRegistered)
    return fail(409, { error: 'already_registered' as const });
  if (error instanceof AlreadyRated) return fail(409, { error: 'already_rated' as const });
  if (error instanceof RateLimited)
    return fail(429, { error: 'rate_limited' as const, retryAfter: error.retryAfterSeconds });
  if (error instanceof DirectMessagesOff)
    return fail(409, { error: 'direct_messages_off' as const });
  if (error instanceof Invalid) return fail(400, { error: 'invalid' as const, field: error.field });

  throw error;
}
