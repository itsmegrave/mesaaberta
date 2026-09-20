import { GrowthBook, type Attributes, type FeatureApiResponse } from '@growthbook/growthbook';
import { flagDefaults, type FlagName } from './registry';

export type Flags = {
	isEnabled(name: FlagName, attributes?: Attributes): Promise<boolean>;
};

type Options = {
	/** Development-only escape hatch for exercising work hidden behind a flag. */
	forceAll?: boolean;
};

const localHostnames = new Set(['localhost', '127.0.0.1']);

/**
 * Whether every flag should read as on. Opt-in twice: the variable must be set to `true` (it is only
 * ever set in `.dev.vars`) and the request must be for a loopback host, so a deployed Worker that
 * has the variable by mistake still evaluates flags normally.
 */
export function shouldForceAllFlags(
	env: { IGNORE_FEATURE_FLAGS_IN_LOCALHOST?: string } | undefined,
	hostname: string
): boolean {
	return env?.IGNORE_FEATURE_FLAGS_IN_LOCALHOST === 'true' && localHostnames.has(hostname);
}

/**
 * Per-request flags. Nothing is loaded until a flag is read, and the payload is loaded once however
 * many flags are read. If GrowthBook cannot answer, every flag returns its default from the registry.
 * `attributes` (user id, role, ...) feed GrowthBook's targeting rules.
 */
export function createFlags(
	loadPayload: () => Promise<FeatureApiResponse | null>,
	{ forceAll = false }: Options = {}
): Flags {
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
			if (forceAll) return true;

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
