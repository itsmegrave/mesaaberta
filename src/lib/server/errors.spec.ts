import { describe, expect, it } from 'vitest';
import {
	AlreadyRegistered,
	Forbidden,
	Invalid,
	NotFound,
	RateLimited,
	TableFull,
	TooEarly,
	failFrom
} from './errors';

describe('failFrom', () => {
	it('turns Forbidden into a 403 form failure', () => {
		expect(failFrom(new Forbidden('table:edit'))).toMatchObject({
			status: 403,
			data: { error: 'forbidden' }
		});
	});

	it('turns NotFound into a 404 form failure', () => {
		expect(failFrom(new NotFound('table'))).toMatchObject({
			status: 404,
			data: { error: 'not_found' }
		});
	});

	it('turns a full table and a repeat join into 409s, so they read as conflicts and not permissions', () => {
		expect(failFrom(new TableFull())).toMatchObject({ status: 409, data: { error: 'table_full' } });
		expect(failFrom(new AlreadyRegistered())).toMatchObject({
			status: 409,
			data: { error: 'already_registered' }
		});
	});

	it('turns RateLimited into a 429 that says how long to wait', () => {
		expect(failFrom(new RateLimited(90))).toMatchObject({
			status: 429,
			data: { error: 'rate_limited', retryAfter: 90 }
		});
	});

	it('turns a rating before the first session ends into a 409', () => {
		expect(failFrom(new TooEarly())).toMatchObject({ status: 409, data: { error: 'too_early' } });
	});

	it('turns Invalid into a 400 that names the field, and nothing else', () => {
		const failure = failFrom(new Invalid('systemSlug', 'no such system: x'));

		expect(failure).toMatchObject({ status: 400, data: { error: 'invalid', field: 'systemSlug' } });
		expect(JSON.stringify(failure)).not.toContain('no such system');
	});

	it('does not put the internal message in what the browser receives', () => {
		const failure = failFrom(new Forbidden('table:edit'));

		expect(JSON.stringify(failure)).not.toContain('table:edit');
	});

	it('rethrows anything else, so a real bug is not reported as a permission problem', () => {
		const bug = new TypeError('undefined is not a function');

		expect(() => failFrom(bug)).toThrow(bug);
	});
});

describe('domain errors', () => {
	it('can be told apart with instanceof and carry a readable name', () => {
		expect(new Forbidden('x')).toBeInstanceOf(Error);
		expect(new Forbidden('x')).not.toBeInstanceOf(NotFound);
		expect(new NotFound('x').name).toBe('NotFound');
	});
});
