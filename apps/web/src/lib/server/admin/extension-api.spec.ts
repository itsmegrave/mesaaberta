import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionViaApi } from './extension-api';

const callApiRaw = vi.fn();

vi.mock('../api-client', () => ({ callApiRaw: (...args: unknown[]) => callApiRaw(...args) }));
vi.mock('@mesaaberta/core/server/extensions/index', () => ({
  extensionById: (id: string) =>
    id === 'fake' ? { id, flags: { api_admin_fake: false } } : id === 'plain' ? { id } : undefined,
}));

const locals = (enabled: boolean) =>
  ({
    env: {},
    log: { warn: vi.fn() },
    flags: { isEnabled: vi.fn(async () => enabled) },
  }) as never as App.Locals;

beforeEach(() => {
  callApiRaw.mockReset();
  callApiRaw.mockResolvedValue({ ok: true, status: 200, body: { eventIds: [] } });
});

describe('extensionViaApi', () => {
  it('asks the api when the extension declares api_admin_<id> and the flag is on', async () => {
    const l = locals(true);

    expect(await extensionViaApi(l, 'fake', 'admin', 'queue', {})).toEqual({ eventIds: [] });
    expect(l.flags.isEnabled).toHaveBeenCalledWith('api_admin_fake', {
      id: 'admin',
      isAdmin: true,
    });
  });

  it('runs the action here when the flag is off', async () => {
    expect(await extensionViaApi(locals(false), 'fake', 'admin', 'queue', {})).toBeNull();
    expect(callApiRaw).not.toHaveBeenCalled();
  });

  it('runs the action here when the extension declares no such flag, or is not installed', async () => {
    const l = locals(true);

    expect(await extensionViaApi(l, 'plain', 'admin', 'queue', {})).toBeNull();
    expect(await extensionViaApi(l, 'missing', 'admin', 'queue', {})).toBeNull();
    expect(l.flags.isEnabled).not.toHaveBeenCalled();
    expect(callApiRaw).not.toHaveBeenCalled();
  });
});
