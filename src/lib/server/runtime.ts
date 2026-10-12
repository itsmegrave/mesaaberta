import type { Handle } from '@sveltejs/kit';

/**
 * Exposes `locals.env`: the variables and bindings the host gave this request. This is the one
 * module that reads them from the host (today Cloudflare's `platform.env`); everything else reads
 * `locals.env`, so another host only has to fill it here. A lint rule keeps it that way.
 */
export const handleRuntime: Handle = ({ event, resolve }) => {
  event.locals.env = event.platform?.env;
  return resolve(event);
};
