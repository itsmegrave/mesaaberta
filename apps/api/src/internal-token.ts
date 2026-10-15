import { createMiddleware } from 'hono/factory';

/** Compares two strings in time that depends only on their length, not on where they differ. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * The gate for an api that listens on a network (the Bun/Docker entry). On Cloudflare the Service
 * Binding is the only way in, so no token is needed there. Over HTTP anyone who can reach the port
 * could claim any `x-actor-id`, so every request must carry the shared secret the web app sends in
 * `x-internal-token`. The api must still never be published to the internet.
 */
export const internalToken = (secret: string) =>
  createMiddleware(async (c, next) => {
    const sent = c.req.header('x-internal-token') ?? '';
    if (!secret || !same(sent, secret)) return c.json({ error: 'unauthorized' }, 401);
    await next();
  });
