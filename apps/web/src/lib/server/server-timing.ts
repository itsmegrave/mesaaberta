import type { Handle } from '@sveltejs/kit/hooks';

/**
 * Says which backend answered (`x-backend`) and how long the app took (`Server-Timing: total`), on
 * every response, plus `db`, the summed time of the request's queries, when it used the database.
 * Cloudflare and a Bun server run the same code, so a benchmark across both reads the same
 * headers. The browser shows the timing in its network panel; nothing here is personal, so it is
 * safe to send to everyone.
 */
export const createHandleServerTiming =
  (backend: string): Handle =>
  async ({ event, resolve }) => {
    const started = performance.now();
    const response = await resolve(event);

    // A redirect or a Response the route froze can have immutable headers: copy before writing.
    const headers = new Headers(response.headers);
    headers.set('x-backend', backend);
    const dbSeconds = event.locals?.dbSeconds;
    const timing = [
      ...(dbSeconds === undefined ? [] : [`db;dur=${(dbSeconds * 1000).toFixed(1)}`]),
      `total;dur=${(performance.now() - started).toFixed(1)}`,
    ].join(', ');
    const existing = headers.get('server-timing');
    headers.set('server-timing', existing ? `${existing}, ${timing}` : timing);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
