import type { Handle } from '@sveltejs/kit/hooks';
import { MAX_IMAGE_BYTES } from '@mesaaberta/core/forms/files';

/**
 * The largest request body the app accepts. A form sends at most one picture of `MAX_IMAGE_BYTES`
 * (the browser shrinks it first) and some text, so this leaves plenty of room. The api is reached
 * only through this Worker, so the limit covers it too.
 */
export const MAX_BODY_BYTES = 4 * MAX_IMAGE_BYTES;

/**
 * Refuses a request whose declared body is over `MAX_BODY_BYTES` with a 413, before any hook opens
 * the database or an action reads `formData()`: otherwise the whole body is read into memory first
 * and only then is a file found too big (review finding #5, Trello #281).
 */
export const handleBodyLimit: Handle = ({ event, resolve }) => {
  const declared = Number(event.request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) {
    return new Response('Payload Too Large', {
      status: 413,
      headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    });
  }
  return resolve(event);
};
