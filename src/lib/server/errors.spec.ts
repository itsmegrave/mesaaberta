import { describe, expect, it } from 'vitest';
import { Forbidden, NotFound, failFrom } from './errors';

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
