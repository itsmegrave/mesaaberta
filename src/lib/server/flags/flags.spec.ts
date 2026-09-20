import type { FeatureApiResponse } from '@growthbook/growthbook';
import { describe, expect, it, vi } from 'vitest';
import { createFlags, shouldForceAllFlags } from './flags';

const payload = (features: FeatureApiResponse['features']): FeatureApiResponse => ({
	features,
	dateUpdated: '2026-09-19T00:00:00.000Z'
});

const serving = (features: FeatureApiResponse['features']) => async () => payload(features);

describe('createFlags', () => {
	it('uses the value GrowthBook serves', async () => {
		const flags = createFlags(serving({ is_platform_released: { defaultValue: true } }));

		expect(await flags.isEnabled('is_platform_released')).toBe(true);
	});

	it('forces every flag on without loading GrowthBook when the local override is enabled', async () => {
		const load = vi.fn(serving({ is_platform_released: { defaultValue: false } }));
		const flags = createFlags(load, { forceAll: true });

		expect(await flags.isEnabled('is_platform_released')).toBe(true);
		expect(load).not.toHaveBeenCalled();
	});

	it('falls back to the safe default when no payload is available', async () => {
		const flags = createFlags(async () => null);

		expect(await flags.isEnabled('is_platform_released')).toBe(false);
	});

	it('falls back to the safe default when the loader throws', async () => {
		const flags = createFlags(async () => {
			throw new Error('boom');
		});

		expect(await flags.isEnabled('is_platform_released')).toBe(false);
	});

	it('falls back to the safe default for a flag GrowthBook does not know yet', async () => {
		const flags = createFlags(serving({}));

		expect(await flags.isEnabled('is_platform_released')).toBe(false);
	});

	it('evaluates targeting rules against the attributes it is given', async () => {
		const features = {
			is_platform_released: {
				defaultValue: false,
				rules: [{ condition: { role: 'admin' }, force: true }]
			}
		};

		const flags = createFlags(serving(features));

		expect(await flags.isEnabled('is_platform_released', { role: 'admin' })).toBe(true);
		expect(await flags.isEnabled('is_platform_released', { role: 'member' })).toBe(false);
	});

	it('loads the payload only once, however many flags are read', async () => {
		const load = vi.fn(serving({ is_platform_released: { defaultValue: true } }));
		const flags = createFlags(load);

		await flags.isEnabled('is_platform_released');
		await flags.isEnabled('is_platform_released');

		expect(load).toHaveBeenCalledTimes(1);
	});

	it('does not load anything until a flag is read', () => {
		const load = vi.fn(serving({}));

		createFlags(load);

		expect(load).not.toHaveBeenCalled();
	});
});

describe('shouldForceAllFlags', () => {
	const on = { IGNORE_FEATURE_FLAGS_IN_LOCALHOST: 'true' };

	it.each(['localhost', '127.0.0.1'])('is on for %s when the variable is true', (host) => {
		expect(shouldForceAllFlags(on, host)).toBe(true);
	});

	it.each(['mesaaberta.app', 'preview.mesaaberta.workers.dev', 'localhost.evil.com'])(
		'stays off for %s even with the variable set',
		(host) => {
			expect(shouldForceAllFlags(on, host)).toBe(false);
		}
	);

	it('stays off on localhost when the variable is unset', () => {
		expect(shouldForceAllFlags({}, 'localhost')).toBe(false);
		expect(shouldForceAllFlags(undefined, 'localhost')).toBe(false);
	});

	it.each(['false', '1', 'TRUE', ''])('stays off on localhost when the variable is %j', (value) => {
		expect(shouldForceAllFlags({ IGNORE_FEATURE_FLAGS_IN_LOCALHOST: value }, 'localhost')).toBe(
			false
		);
	});

	it('keeps evaluating flags normally when the bypass is off', async () => {
		const flags = createFlags(serving({ is_platform_released: { defaultValue: false } }), {
			forceAll: shouldForceAllFlags(on, 'mesaaberta.app')
		});

		expect(await flags.isEnabled('is_platform_released')).toBe(false);
	});
});
