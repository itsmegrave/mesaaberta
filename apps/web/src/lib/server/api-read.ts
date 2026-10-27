import { error } from '@sveltejs/kit';
import { Forbidden, NotFound, TableConcluded } from '@mesaaberta/core/server/errors';
import { requireApi } from './api-required';

/**
 * Reads a page's data from the api Worker as `actorId` (null: a visitor), which is where the
 * database is read; there is no web fallback. The api's refusals become the page's own errors:
 * not found a 404, forbidden a 403 and a concluded table a 403 with its code. A call that cannot be
 * made, or any other failure, is a 503. With a `body`, the read is a POST: one that also writes
 * (opening a thread reads it).
 */
export async function readFromApi<T>(
  locals: App.Locals,
  actorId: string | null,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await requireApi<T>(
      locals,
      actorId === null ? null : { id: actorId },
      path,
      body === undefined ? {} : { method: 'POST', body },
    );
  } catch (cause) {
    // Before `Forbidden`, which it extends: the page tells the GM why.
    if (cause instanceof TableConcluded)
      error(403, { message: 'Forbidden', code: 'table_concluded' });
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
}
