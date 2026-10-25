import type { FeatureApiResponse } from '@growthbook/growthbook';
import { describe, expect, it, vi } from 'vitest';
import { createFlags, flagOverrides, shouldForceAllFlags } from './flags';

const payload = (features: FeatureApiResponse['features']): FeatureApiResponse => ({
  features,
  dateUpdated: '2026-09-19T00:00:00.000Z',
});

const serving = (features: FeatureApiResponse['features']) => async () => payload(features);

describe('createFlags', () => {
  it('reads the defaults an extension declares, and off for a name nobody declared', async () => {
    const flags = createFlags(async () => null, { extensionFlags: { private_perk: true } });

    expect(await flags.isEnabled('private_perk')).toBe(true);
    expect(await flags.isEnabled('nobody_declared_this')).toBe(false);
  });

  it('serves an extension flag from GrowthBook, over its declared default', async () => {
    const flags = createFlags(serving({ private_perk: { defaultValue: false } }), {
      extensionFlags: { private_perk: true },
    });

    expect(await flags.isEnabled('private_perk')).toBe(false);
  });

  it('turns an extension flag on in the preview mode, but leaves the kill switch off', async () => {
    const flags = createFlags(async () => null, { forceAll: true });

    expect(await flags.isEnabled('private_perk')).toBe(true);
    expect(await flags.isEnabled('maintenance_mode')).toBe(false);
  });

  it('disables table photos unless GrowthBook explicitly enables them', async () => {
    expect(await createFlags(async () => null).isEnabled('api_inbox')).toBe(false);
    expect(
      await createFlags(serving({ api_inbox: { defaultValue: true } })).isEnabled('api_inbox'),
    ).toBe(true);
  });
  it('uses the value GrowthBook serves', async () => {
    const flags = createFlags(serving({ api_inbox: { defaultValue: true } }));

    expect(await flags.isEnabled('api_inbox')).toBe(true);
  });

  it('forces every flag on without loading GrowthBook when the local override is enabled', async () => {
    const load = vi.fn(serving({ api_inbox: { defaultValue: false } }));
    const flags = createFlags(load, { forceAll: true });

    expect(await flags.isEnabled('api_inbox')).toBe(true);
    expect(load).not.toHaveBeenCalled();
  });

  it('leaves the kill switches off in the local preview mode, so it never locks anyone out', async () => {
    const flags = createFlags(serving({}), { forceAll: true });

    expect(await flags.isEnabled('maintenance_mode')).toBe(false);
  });

  it('lets a fixed override win over GrowthBook, the defaults and the preview mode', async () => {
    const load = vi.fn(serving({ maintenance_mode: { defaultValue: false } }));
    const flags = createFlags(load, {
      forceAll: true,
      overrides: { maintenance_mode: true, api_inbox: false },
    });

    expect(await flags.isEnabled('maintenance_mode')).toBe(true);
    expect(await flags.isEnabled('api_inbox')).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the site up by default', async () => {
    const flags = createFlags(async () => null);

    expect(await flags.isEnabled('maintenance_mode')).toBe(false);
  });

  it('falls back to the safe default when no payload is available', async () => {
    const flags = createFlags(async () => null);

    expect(await flags.isEnabled('api_inbox')).toBe(false);
  });

  it('falls back to the safe default when the loader throws', async () => {
    const flags = createFlags(async () => {
      throw new Error('boom');
    });

    expect(await flags.isEnabled('api_inbox')).toBe(false);
  });

  it('falls back to the safe default for a flag GrowthBook does not know yet', async () => {
    const flags = createFlags(serving({}));

    expect(await flags.isEnabled('api_inbox')).toBe(false);
  });

  it('evaluates targeting rules against the attributes it is given', async () => {
    const features = {
      api_inbox: {
        defaultValue: false,
        rules: [{ condition: { role: 'admin' }, force: true }],
      },
    };

    const flags = createFlags(serving(features));

    expect(await flags.isEnabled('api_inbox', { role: 'admin' })).toBe(true);
    expect(await flags.isEnabled('api_inbox', { role: 'member' })).toBe(false);
  });

  it('loads the payload only once, however many flags are read', async () => {
    const load = vi.fn(serving({ api_inbox: { defaultValue: true } }));
    const flags = createFlags(load);

    await flags.isEnabled('api_inbox');
    await flags.isEnabled('api_inbox');

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
    },
  );

  it('stays off on localhost when the variable is unset', () => {
    expect(shouldForceAllFlags({}, 'localhost')).toBe(false);
    expect(shouldForceAllFlags(undefined, 'localhost')).toBe(false);
  });

  it.each(['false', '1', 'TRUE', ''])('stays off on localhost when the variable is %j', (value) => {
    expect(shouldForceAllFlags({ IGNORE_FEATURE_FLAGS_IN_LOCALHOST: value }, 'localhost')).toBe(
      false,
    );
  });

  it('keeps evaluating flags normally when the bypass is off', async () => {
    const flags = createFlags(serving({ api_inbox: { defaultValue: false } }), {
      forceAll: shouldForceAllFlags(on, 'mesaaberta.app'),
    });

    expect(await flags.isEnabled('api_inbox')).toBe(false);
  });
});

describe('flagOverrides', () => {
  const env = { FEATURE_FLAG_OVERRIDES: 'maintenance_mode=true, api_inbox = false' };

  it('reads the fixed values on a loopback host', () => {
    expect(flagOverrides(env, 'localhost')).toEqual({
      maintenance_mode: true,
      api_inbox: false,
    });
    expect(flagOverrides(env, '127.0.0.1')).toEqual({
      maintenance_mode: true,
      api_inbox: false,
    });
  });

  it('is ignored on any other host, so a deployed Worker cannot be switched by a variable', () => {
    expect(flagOverrides(env, 'mesaaberta.com.br')).toEqual({});
  });

  it('skips unknown flags and values that are not true or false', () => {
    expect(
      flagOverrides({ FEATURE_FLAG_OVERRIDES: 'nope=true,maintenance_mode=yes' }, 'localhost'),
    ).toEqual({});
  });

  it('is empty without the variable', () => {
    expect(flagOverrides(undefined, 'localhost')).toEqual({});
  });
});
