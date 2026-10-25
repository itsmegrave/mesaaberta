import { logger as defaultLogger, type Logger } from '../logger';

// Kept apart from observe.ts, which imports the installed extensions: a universal load (the admin
// panel page) bundles this file for the browser, and with the private package installed the
// extensions' server code (the Instagram image's resvg .wasm) would follow it there.

/**
 * Runs a load (a panel, a widget, a module) and logs how long it took. A failure is logged as an
 * error, reported, and rethrown: the caller still decides what the person sees.
 */
export async function observedLoad<T>(
  resourceType: string,
  resourceId: string,
  load: () => Promise<T>,
  log: Logger = defaultLogger,
  now: () => number = Date.now,
): Promise<T> {
  const started = now();
  try {
    const loaded = await load();
    log.info('extension.loaded', { resourceType, resourceId, durationMs: now() - started });
    return loaded;
  } catch (error) {
    log.error('extension.load_failed', {
      resourceType,
      resourceId,
      durationMs: now() - started,
      error,
    });
    throw error;
  }
}
