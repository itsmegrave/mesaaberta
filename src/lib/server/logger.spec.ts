import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

const capture = () => {
	const lines: Record<string, unknown>[] = [];
	const log = createLogger({
		write: (_level, line) => lines.push(JSON.parse(line)),
		now: () => new Date('2026-09-19T21:00:00.000Z')
	});

	return { lines, log };
};

describe('logger', () => {
	it('writes one JSON line with level, message and time', () => {
		const { lines, log } = capture();

		log.info('booked', { table: 7 });

		expect(lines).toEqual([
			{ level: 'info', msg: 'booked', time: '2026-09-19T21:00:00.000Z', table: 7 }
		]);
	});

	it('sends each level to its own console method', () => {
		const calls: string[] = [];
		const log = createLogger({ write: (level) => calls.push(level) });

		log.debug('a');
		log.info('b');
		log.warn('c');
		log.error('d');

		expect(calls).toEqual(['debug', 'info', 'warn', 'error']);
	});

	it('stamps every line of a child logger with its bindings, and the parent stays clean', () => {
		const { lines, log } = capture();
		const request = log.child({ requestId: '8f3a-LHR', userId: 'user-1' });

		request.info('first');
		request.warn('second');
		log.info('outside');

		expect(lines[0]).toMatchObject({ requestId: '8f3a-LHR', userId: 'user-1' });
		expect(lines[1]).toMatchObject({ requestId: '8f3a-LHR', userId: 'user-1' });
		expect(lines[2]).not.toHaveProperty('requestId');
	});

	it('omits the user id while nobody is signed in', () => {
		const { lines, log } = capture();

		log.child({ requestId: 'r1', userId: undefined }).info('anonymous');

		expect(lines[0]).not.toHaveProperty('userId');
	});

	it('does not let a field overwrite the level, message or time', () => {
		const { lines, log } = capture();

		log.info('real', { level: 'fatal', msg: 'fake', time: 'yesterday' });

		expect(lines[0]).toMatchObject({
			level: 'info',
			msg: 'real',
			time: '2026-09-19T21:00:00.000Z'
		});
	});

	describe('PII', () => {
		it.each(['email', 'Email', 'userEmail', 'e-mail', 'token', 'accessToken', 'password', 'cpf'])(
			'redacts the value of a "%s" field',
			(key) => {
				const { lines, log } = capture();

				log.info('signup', { [key]: 'sensitive-value' });

				expect(JSON.stringify(lines[0])).not.toContain('sensitive-value');
				expect(lines[0][key]).toBe('[redacted]');
			}
		);

		it('redacts sensitive fields nested inside objects and arrays', () => {
			const { lines, log } = capture();

			log.info('deep', { request: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } } });
			log.info('list', { people: [{ name: 'Ana', phone: '+55 11 99999-0000' }] });

			expect(JSON.stringify(lines)).not.toMatch(/Bearer abc|sid=1|99999/);
			expect(lines[1].people).toEqual([{ name: 'Ana', phone: '[redacted]' }]);
		});

		it('keeps harmless fields that only look similar', () => {
			const { lines, log } = capture();

			log.info('game', { session: 12, description: 'one shot' });

			expect(lines[0]).toMatchObject({ session: 12, description: 'one shot' });
		});

		it('scrubs an email address or bearer token written into a message or string value', () => {
			const { lines, log } = capture();

			log.error('rejected ana@example.com', { detail: 'sent Bearer eyJhbGciOi.payload.sig' });

			expect(JSON.stringify(lines[0])).not.toMatch(/ana@example|eyJhbGciOi/);
			expect(lines[0].msg).toBe('rejected [redacted]');
		});

		it('logs an error as its name and message, never its stack', () => {
			const { lines, log } = capture();
			const error = new TypeError('bad input from ana@example.com');

			log.error('failed', { error });

			expect(lines[0].error).toEqual({ name: 'TypeError', message: 'bad input from [redacted]' });
		});
	});

	it('survives a self-referencing field instead of throwing', () => {
		const { lines, log } = capture();
		const loop: Record<string, unknown> = {};
		loop.self = loop;

		expect(() => log.info('loop', { loop })).not.toThrow();
		expect(lines).toHaveLength(1);
	});
});
