import { safeFields, scrubString } from '../observability/privacy';
export { scrubString } from '../observability/privacy';

export type Level = 'debug' | 'info' | 'warn' | 'error';

export type Fields = Record<string, unknown>;

export type Logger = {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** A logger that stamps safe `bindings` (request id, release, ...) onto every line. */
  child(bindings: Fields): Logger;
};

/**
 * Where a deployment sends telemetry besides the console. The logger knows no vendor: the web app
 * installs one (Sentry) at startup, and a deployment without one still logs to the console.
 */
export type TelemetrySink = {
  /** Mirrors one structured line. `fields` are already safe. */
  log(level: Level, msg: string, fields: Fields): void;
  /** Reports a handled operational error as an issue. `tags` are already safe. */
  capture(error: Error, tags: Fields): void;
};

let sink: TelemetrySink | null = null;

/** Installs (or, with `null`, removes) the process-wide telemetry sink. */
export const setTelemetrySink = (next: TelemetrySink | null) => {
  sink = next;
};

type Options = {
  write?: (level: Level, line: string) => void;
  now?: () => Date;
};

const safeError = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined;
  const error = value as { name?: unknown; code?: unknown; cause?: { code?: unknown } };
  return safeFields({
    errorType: typeof error.name === 'string' ? error.name : 'Error',
    code: error.code,
    causeCode: error.cause?.code,
  });
};

const consoleWrite = (level: Level, line: string) => {
  console[level](line);
  try {
    const { msg, ...fields } = JSON.parse(line);
    sink?.log(level, msg, safeFields(fields));
  } catch {
    // Telemetry must never change the application's outcome or recursively log failures.
  }
};

/**
 * Structured JSON logger: one line per call, so Workers Logs indexes every field. Callers pass
 * safe operational fields; unknown fields are dropped before any destination.
 */
export function createLogger(
  { write = consoleWrite, now = () => new Date() }: Options = {},
  bindings: Fields = {},
): Logger {
  const log = (level: Level, msg: string, fields: Fields = {}) => {
    const line = {
      ...safeFields({ ...fields, ...bindings }),
      ...safeError(fields.error),
      service: 'mesaaberta',
      schemaVersion: 1,
      time: now().toISOString(),
      level,
      msg: scrubString(msg),
    };

    try {
      write(level, JSON.stringify(line));
      // The framework reports unhandled errors already; handled operational errors need an issue too.
      if (
        write === consoleWrite &&
        level === 'error' &&
        fields.error instanceof Error &&
        msg !== 'unhandled error' &&
        msg !== 'request.failed'
      ) {
        sink?.capture(
          fields.error,
          safeFields({ ...fields, ...bindings, ...safeError(fields.error) }),
        );
      }
    } catch {
      // A failed destination must not fail a request or dispatch.
    }
  };

  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (extra) => createLogger({ write, now }, { ...bindings, ...extra }),
  };
}

export const logger = createLogger();
