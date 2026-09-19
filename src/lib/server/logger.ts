export type Level = 'debug' | 'info' | 'warn' | 'error';

export type Fields = Record<string, unknown>;

export type Logger = {
	debug(msg: string, fields?: Fields): void;
	info(msg: string, fields?: Fields): void;
	warn(msg: string, fields?: Fields): void;
	error(msg: string, fields?: Fields): void;
	/** A logger that stamps `bindings` (request id, user id, ...) onto every line it writes. */
	child(bindings: Fields): Logger;
};

type Options = {
	write?: (level: Level, line: string) => void;
	now?: () => Date;
};

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

// Field names whose values are never written. Matched on the lowercased name with `-`/`_` removed,
// so `userEmail`, `e-mail` and `access_token` are all caught. Erring towards redacting is the point.
const SENSITIVE_PARTS = [
	'email',
	'token',
	'password',
	'passwd',
	'secret',
	'authorization',
	'cookie',
	'phone',
	'apikey',
	'credential',
	'cpf'
];
// Too short to match as a part without catching harmless names such as `description`.
const SENSITIVE_NAMES = new Set(['ip', 'sessionid']);

const isSensitiveKey = (key: string) => {
	const name = key.toLowerCase().replace(/[-_]/g, '');
	return SENSITIVE_NAMES.has(name) || SENSITIVE_PARTS.some((part) => name.includes(part));
};

// Catches PII written straight into a message or value, where no field name can flag it.
const scrubString = (text: string) =>
	text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, REDACTED).replace(/\bBearer\s+\S+/gi, REDACTED);

const sanitize = (value: unknown, depth = 0): unknown => {
	if (typeof value === 'string') return scrubString(value);
	if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value.toString();
	if (value instanceof Date) return value.toISOString();
	// Name and message only: stacks and `cause` can carry request data.
	if (value instanceof Error) return sanitize({ name: value.name, message: value.message }, depth);
	if (typeof value !== 'object') return undefined;
	if (depth >= MAX_DEPTH) return '[truncated]';

	if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			isSensitiveKey(key) ? REDACTED : sanitize(item, depth + 1)
		])
	);
};

const consoleWrite = (level: Level, line: string) => console[level](line);

/**
 * Structured JSON logger: one line per call, so Workers Logs indexes every field. Callers pass
 * plain fields; anything that looks like PII is redacted before the line is written.
 */
export function createLogger(
	{ write = consoleWrite, now = () => new Date() }: Options = {},
	bindings: Fields = {}
): Logger {
	const log = (level: Level, msg: string, fields: Fields = {}) => {
		const line = {
			...(sanitize({ ...fields, ...bindings }) as Fields),
			time: now().toISOString(),
			level,
			msg: scrubString(msg)
		};

		write(level, JSON.stringify(line));
	};

	return {
		debug: (msg, fields) => log('debug', msg, fields),
		info: (msg, fields) => log('info', msg, fields),
		warn: (msg, fields) => log('warn', msg, fields),
		error: (msg, fields) => log('error', msg, fields),
		child: (extra) => createLogger({ write, now }, { ...bindings, ...extra })
	};
}

export const logger = createLogger();
