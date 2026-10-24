import { error } from '@sveltejs/kit';
import { backend } from '#lib/server/runtime.js';
import { webMetrics } from '#lib/server/http-metrics.js';
import type { RequestHandler } from './$types';

// Prometheus text for a scraper on the Docker network. Only a Bun server serves it: on Workers
// every isolate would report its own few requests, so there it is a plain 404. The proxy in front
// (docker/caddy/Caddyfile) does not forward it, and the numbers carry no personal data either way.
export const GET: RequestHandler = () => {
  if (backend !== 'bun') error(404, 'Not found');
  return new Response(webMetrics.render(), {
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
