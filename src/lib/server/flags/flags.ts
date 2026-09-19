import { GrowthBook, type Attributes, type FeatureApiResponse } from '@growthbook/growthbook';
import { flagDefaults, type FlagName } from './registry';

export type Flags = {
	isEnabled(name: FlagName, attributes?: Attributes): Promise<boolean>;
};

/**
 * Per-request flags. Nothing is loaded until a flag is read, and the payload is loaded once however
 * many flags are read. If GrowthBook cannot answer, every flag returns its default from the registry.
 * `attributes` (user id, role, ...) feed GrowthBook's targeting rules.
 */
export function createFlags(loadPayload: () => Promise<FeatureApiResponse | null>): Flags {
	let payload: Promise<FeatureApiResponse | null> | undefined;

	const load = () =>
		(payload ??= (async () => {
			try {
				return await loadPayload();
			} catch (error) {
				console.error('flags: could not load feature payload:', String(error));
				return null;
			}
		})());

	return {
		async isEnabled(name, attributes = {}) {
			const response = await load();
			if (!response) return flagDefaults[name];

			try {
				const growthbook = new GrowthBook({ attributes });
				await growthbook.setPayload(response);
				return growthbook.getFeatureValue(name, flagDefaults[name]);
			} catch (error) {
				console.error('flags: could not evaluate features:', String(error));
				return flagDefaults[name];
			}
		}
	};
}
