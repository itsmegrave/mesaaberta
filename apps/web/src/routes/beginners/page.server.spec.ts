import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

const run = (on: boolean) =>
  load({
    locals: {
      getProfile: async () => null,
      flags: { isEnabled: vi.fn(async () => on) },
    },
  } as unknown as Parameters<typeof load>[0]);

describe('Primeira mesa guide', () => {
  it('opens for visitors while Iniciantes is on', async () => {
    await expect(run(true)).resolves.toEqual({});
  });

  it('is a 404 while it is off', async () => {
    await expect(run(false)).rejects.toMatchObject({ status: 404 });
  });
});
