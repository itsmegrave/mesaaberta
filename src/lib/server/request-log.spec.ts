import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { handleRequestLog } from './request-log';

const setup = () => {
	const lines: Record<string, unknown>[] = [];
	const logger = createLogger({ write: (_level, line) => lines.push(JSON.parse(line)) });
	const handle = handleRequestLog(logger);

	const run = async (url: string, headers: Record<string, string> = {}, status = 200) => {
		const event = {
			request: new Request(url, { method: 'POST', headers }),
			url: new URL(url),
			locals: {}
		} as unknown as RequestEvent;

		await handle({ event, resolve: async () => new Response(null, { status }) });

		return event;
	};

	return { lines, run, handle };
};

describe('handleRequestLog', () => {
	it('uses the Cloudflare ray id as the request id', async () => {
		const { lines, run } = setup();

		await run('https://mesaaberta.test/', { 'cf-ray': '8f3a1c2b4d5e6f70-GRU' });

		expect(lines[0]).toMatchObject({ requestId: '8f3a1c2b4d5e6f70-GRU' });
	});

	it('makes up a request id when there is no cf-ray header, as in local dev', async () => {
		const { lines, run } = setup();

		await run('https://mesaaberta.test/');
		await run('https://mesaaberta.test/');

		expect(lines[0].requestId).toEqual(expect.any(String));
		expect(lines[0].requestId).not.toBe(lines[1].requestId);
	});

	it('gives routes a logger that carries the same request id', async () => {
		const { lines, run } = setup();

		const event = await run('https://mesaaberta.test/', { 'cf-ray': 'abc-GRU' });
		event.locals.log.info('from a route');

		expect(lines.at(-1)).toMatchObject({ msg: 'from a route', requestId: 'abc-GRU' });
	});

	it('logs method, path, status and duration once per request', async () => {
		const { lines, run } = setup();

		await run('https://mesaaberta.test/healthz', {}, 204);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			msg: 'request',
			method: 'POST',
			path: '/healthz',
			status: 204,
			durationMs: expect.any(Number)
		});
	});

	it('adds the user id to the request line once a later hook has signed someone in', async () => {
		const { lines, handle } = setup();
		const event = {
			request: new Request('https://mesaaberta.test/'),
			url: new URL('https://mesaaberta.test/'),
			locals: {}
		} as unknown as RequestEvent;

		await handle({
			event,
			resolve: async () => {
				event.locals.userId = 'user-1';
				return new Response();
			}
		});

		expect(lines[0]).toMatchObject({ userId: 'user-1' });
	});

	it('never logs the query string, which can carry tokens', async () => {
		const { lines, run } = setup();

		await run('https://mesaaberta.test/login?token=s3cret&email=ana@example.com');

		expect(JSON.stringify(lines)).not.toMatch(/s3cret|ana@example/);
		expect(lines[0].path).toBe('/login');
	});
});
