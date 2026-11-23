import type { FeatureApiResponse } from '@growthbook/growthbook';
import { describe, expect, it, vi } from 'vitest';
import { setTelemetrySink } from '../logger';
import { createFlags, flagOverrides, shouldForceAllFlags } from './flags';

const payload = (features: FeatureApiResponse['features']): FeatureApiResponse => ({
  features,
  dateUpdated: '2026-09-19T00:00:00.000Z',
});

const serving = (features: FeatureApiResponse['features']) => async () => payload(features);

describe('createFlags', () => {
  it('hands every evaluation to the telemetry sink', async () => {
    const flag = vi.fn();
    setTelemetrySink({ log: vi.fn(), capture: vi.fn(), flag });
    try {
      const flags = createFlags(serving({ api_events_fenced_leases: { defaultValue: true } }));
      await flags.isEnabled('api_events_fenced_leases');
      await flags.isEnabled('maintenance_mode');
    } finally {
      setTelemetrySink(null);
    }

    expect(flag.mock.calls).toEqual([
      ['api_events_fenced_leases', true],
      ['maintenance_mode', false],
    ]);
  });

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
    expect(await createFlags(async () => null).isEnabled('api_events_fenced_leases')).toBe(false);
    expect(
      await createFlags(serving({ api_events_fenced_leases: { defaultValue: true } })).isEnabled(
        'api_events_fenced_leases',
      ),
    ).toBe(true);
  });
  it('uses the value GrowthBook serves', async () => {
    const flags = createFlags(serving({ api_events_fenced_leases: { defaultValue: true } }));

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(true);
  });

  it('forces every flag on without loading GrowthBook when the local override is enabled', async () => {
    const load = vi.fn(serving({ api_events_fenced_leases: { defaultValue: false } }));
    const flags = createFlags(load, { forceAll: true });

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(true);
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
      overrides: { maintenance_mode: true, api_events_fenced_leases: false },
    });

    expect(await flags.isEnabled('maintenance_mode')).toBe(true);
    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the site up by default', async () => {
    const flags = createFlags(async () => null);

    expect(await flags.isEnabled('maintenance_mode')).toBe(false);
  });

  it('falls back to the safe default when no payload is available', async () => {
    const flags = createFlags(async () => null);

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(false);
  });

  it('falls back to the safe default when the loader throws', async () => {
    const flags = createFlags(async () => {
      throw new Error('boom');
    });

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(false);
  });

  it('falls back to the safe default for a flag GrowthBook does not know yet', async () => {
    const flags = createFlags(serving({}));

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(false);
  });

  it('evaluates targeting rules against the attributes it is given', async () => {
    const features = {
      api_events_fenced_leases: {
        defaultValue: false,
        rules: [{ condition: { role: 'admin' }, force: true }],
      },
    };

    const flags = createFlags(serving(features));

    expect(await flags.isEnabled('api_events_fenced_leases', { role: 'admin' })).toBe(true);
    expect(await flags.isEnabled('api_events_fenced_leases', { role: 'member' })).toBe(false);
  });

  it('loads the payload only once, however many flags are read', async () => {
    const load = vi.fn(serving({ api_events_fenced_leases: { defaultValue: true } }));
    const flags = createFlags(load);

    await flags.isEnabled('api_events_fenced_leases');
    await flags.isEnabled('api_events_fenced_leases');

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
    const flags = createFlags(serving({ api_events_fenced_leases: { defaultValue: false } }), {
      forceAll: shouldForceAllFlags(on, 'mesaaberta.app'),
    });

    expect(await flags.isEnabled('api_events_fenced_leases')).toBe(false);
  });
});

describe('flagOverrides', () => {
  const env = { FEATURE_FLAG_OVERRIDES: 'maintenance_mode=true, api_events_fenced_leases = false' };

  it('reads the fixed values on a loopback host', () => {
    expect(flagOverrides(env, 'localhost')).toEqual({
      maintenance_mode: true,
      api_events_fenced_leases: false,
    });
    expect(flagOverrides(env, '127.0.0.1')).toEqual({
      maintenance_mode: true,
      api_events_fenced_leases: false,
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

describe('an encrypted GrowthBook payload', () => {
  // The way GrowthBook encrypts it: AES-CBC with the SDK connection's key, as `iv.ciphertext`.
  const encrypt = async (features: FeatureApiResponse['features']) => {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    const key = btoa(String.fromCharCode(...raw));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const cryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, [
      'encrypt',
    ]);
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        new TextEncoder().encode(JSON.stringify(features)),
      ),
    );
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    return {
      key,
      payload: {
        encryptedFeatures: `${b64(iv)}.${b64(cipher)}`,
        dateUpdated: '2026-11-23T00:00:00.000Z',
      } as FeatureApiResponse,
    };
  };

  it('reads the flags with the decryption key, so targeting ids never travel in the clear', async () => {
    const { key, payload: sealed } = await encrypt({ maintenance_mode: { defaultValue: true } });
    const flags = createFlags(async () => sealed, { decryptionKey: key });

    expect(await flags.isEnabled('maintenance_mode')).toBe(true);
  });

  it('falls back to the defaults, and says so, when the key is missing', async () => {
    const { payload: sealed } = await encrypt({ maintenance_mode: { defaultValue: true } });
    const log = { warn: vi.fn() };
    const flags = createFlags(async () => sealed, { log });

    expect(await flags.isEnabled('maintenance_mode')).toBe(false);
    expect(log.warn).toHaveBeenCalledWith('flags.payload.encrypted_without_key', {});
  });

  it('still reads a payload sent in the clear when a key is set', async () => {
    const flags = createFlags(serving({ maintenance_mode: { defaultValue: true } }), {
      decryptionKey: 'unused',
    });

    expect(await flags.isEnabled('maintenance_mode')).toBe(true);
  });
});
