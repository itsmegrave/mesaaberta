import { logger as defaultLogger, type Logger } from '../logger';
import { extensions, type Extension } from './index';

/**
 * Follows what the extension seam loads. A private build can fail in ways the public code cannot
 * see (a module that does not import, a panel that throws), so each load leaves a line and each
 * failure is an `error` carrying the `Error`, which the logger reports to the telemetry sink
 * (Sentry on the web app and the Workers). Lines carry `resourceType` and `resourceId` only: never
 * a path, a message from the module or any data.
 */

/** One line per installed extension at startup; a build without any says so. */
export function logInstalled(
  list: readonly Extension[] = extensions,
  log: Logger = defaultLogger,
): void {
  if (list.length === 0) log.info('extensions.none');
  for (const extension of list) {
    log.info('extension.installed', { resourceType: 'extension', resourceId: extension.id });
  }
}

export { observedLoad } from './observe-load';
