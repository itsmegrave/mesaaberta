import type { HostBindings } from './types';

/**
 * A Bun (or Node) server, for self-hosting and for the tests: the variables are the process's, the
 * process is long-lived so a promise nobody awaits still finishes (a failure is the task's own to
 * log), there is no shared cache, and there is no Workers context to set error reporting up around.
 */
export const host: HostBindings = {
  name: 'bun',
  env: () => process.env as unknown as App.Locals['env'],
  waitUntil: (promise) => void promise.catch(() => undefined),
  cache: undefined,
  telemetry:
    () =>
    ({ event, resolve }) =>
      resolve(event),
};
