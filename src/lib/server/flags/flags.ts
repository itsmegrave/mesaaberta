import { GrowthBook, type Attributes, type FeatureApiResponse } from '@growthbook/growthbook';
import { flagDefaults, type FlagName } from './registry';

export type Flags = {
	isEnabled(name: FlagName): Promise<boolean>;
};

/**
 * Per-request flags. Nothing is loaded until a flag is read, and the payload is loaded once however
 * many flags are read. If GrowthBook cannot answer, every flag returns its default from the registry.
 * `attributes` (user id, role, ...) feed GrowthBook's targeting rules.
 */
export function createFlags(
	loadPayload: () => Promise<FeatureApiResponse | null>,
	attributes: Attributes = {}
): Flags {
	let growthbook: Promise<GrowthBook | null> | undefined;

	const ready = () =>
		(growthbook ??= (async () => {
			try {
				const payload = await loadPayload();
				if (!payload) return null;

				const instance = new GrowthBook({ attributes });
				await instance.setPayload(payload);
				return instance;
			} catch (error) {
				console.error('flags: could not evaluate features:', String(error));
				return null;
			}
		})());

	return {
		async isEnabled(name) {
			const instance = await ready();
			return instance ? instance.getFeatureValue(name, flagDefaults[name]) : flagDefaults[name];
		}
	};
}
