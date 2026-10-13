import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

const run = (on: boolean) =>
  load({
    locals: { flags: { isEnabled: async () => on } },
  } as unknown as Parameters<typeof load>[0]);

describe('the maintenance page', () => {
  it('does not exist while the site is up', async () => {
    await expect(run(false)).rejects.toMatchObject({ status: 404 });
  });

  it('is there while the site is down', async () => {
    await expect(run(true)).resolves.toBeUndefined();
  });
});
