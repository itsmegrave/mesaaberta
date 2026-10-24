import type { Handle } from '@sveltejs/kit/hooks';
import { createHttpMetrics } from '@mesaaberta/core/server/metrics';

/** The web process's counts, read by `/metrics`. */
export const webMetrics = createHttpMetrics('web');

/** Counts each finished request by its route template. A thrown error is counted as a 500. */
export const handleHttpMetrics: Handle = async ({ event, resolve }) => {
  const started = performance.now();
  let status = 500;
  try {
    const response = await resolve(event);
    status = response.status;
    return response;
  } catch (error) {
    // `error()` and `redirect()` carry the status they answer with.
    const carried = (error as { status?: unknown } | null)?.status;
    if (typeof carried === 'number') status = carried;
    throw error;
  } finally {
    webMetrics.observe({
      route: event.route?.id ?? '/unmatched',
      method: event.request.method,
      status,
      seconds: (performance.now() - started) / 1000,
    });
  }
};
