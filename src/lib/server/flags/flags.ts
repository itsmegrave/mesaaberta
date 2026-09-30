import { logger, type Logger } from '../logger';
import { GrowthBook, type Attributes, type FeatureApiResponse } from '@growthbook/growthbook';
import { flagDefaults, isFlagName, killSwitches, type FlagName } from './registry';

export type Flags = {
  isEnabled(name: FlagName, attributes?: Attributes): Promise<boolean>;
};

type Options = {
  log?: Pick<Logger, 'warn'>;
  /** Development-only escape hatch for exercising work hidden behind a flag. */
  forceAll?: boolean;
  /** Fixed values that win over GrowthBook and the defaults; see `flagOverrides`. */
  overrides?: Partial<Record<FlagName, boolean>>;
};

const localHostnames = new Set(['localhost', '127.0.0.1']);

/**
 * Whether every flag should read as on. Opt-in twice: the variable must be set to `true` (it is only
 * ever set in `.dev.vars`) and the request must be for a loopback host, so a deployed Worker that
 * has the variable by mistake still evaluates flags normally.
 */
export function shouldForceAllFlags(
  env: { IGNORE_FEATURE_FLAGS_IN_LOCALHOST?: string } | undefined,
  hostname: string,
): boolean {
  return env?.IGNORE_FEATURE_FLAGS_IN_LOCALHOST === 'true' && localHostnames.has(hostname);
}

/**
 * Fixed flag values for a local run, from `FEATURE_FLAG_OVERRIDES` (`maintenance_mode=true,other=false`).
 * The end-to-end tests use it to start a server with a flag on without GrowthBook. Like
 * `shouldForceAllFlags`, it only applies to a loopback host, so a deployed Worker ignores it.
 * Unknown names and values other than `true`/`false` are skipped.
 */
export function flagOverrides(
  env: { FEATURE_FLAG_OVERRIDES?: string } | undefined,
  hostname: string,
): Partial<Record<FlagName, boolean>> {
  const overrides: Partial<Record<FlagName, boolean>> = {};
  if (!env?.FEATURE_FLAG_OVERRIDES || !localHostnames.has(hostname)) return overrides;

  for (const pair of env.FEATURE_FLAG_OVERRIDES.split(',')) {
    const [name, value] = pair.split('=').map((part) => part.trim());
    if (isFlagName(name) && (value === 'true' || value === 'false')) {
      overrides[name] = value === 'true';
    }
  }
  return overrides;
}

/**
 * Per-request flags. Nothing is loaded until a flag is read, and the payload is loaded once however
 * many flags are read. If GrowthBook cannot answer, every flag returns its default from the registry.
 * `attributes` (user id, role, ...) feed GrowthBook's targeting rules.
 */
export function createFlags(
  loadPayload: () => Promise<FeatureApiResponse | null>,
  { forceAll = false, overrides = {}, log = logger }: Options = {},
): Flags {
  let payload: Promise<FeatureApiResponse | null> | undefined;

  const load = () =>
    (payload ??= (async () => {
      try {
        return await loadPayload();
      } catch (error) {
        log.warn('flags.payload.failed', { error });
        return null;
      }
    })());

  return {
    async isEnabled(name, attributes = {}) {
      const fixed = overrides[name];
      if (fixed !== undefined) return fixed;
      if (forceAll) return !killSwitches.has(name);

      const response = await load();
      if (!response) return flagDefaults[name];

      try {
        const growthbook = new GrowthBook({ attributes });
        await growthbook.setPayload(response);
        return growthbook.getFeatureValue(name, flagDefaults[name]);
      } catch (error) {
        log.warn('flags.evaluation.failed', { error });
        return flagDefaults[name];
      }
    },
  };
}
