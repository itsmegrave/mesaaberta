import type { FeatureApiResponse } from '@growthbook/growthbook';
import { describe, expect, it, vi } from 'vitest';
import { createFlags } from './flags';

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
