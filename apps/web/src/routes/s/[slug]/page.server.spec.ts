import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSystemPage } from '@mesaaberta/core/server/systems/directory';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/systems/directory', () => ({ readSystemPage: vi.fn() }));

const flagged = vi.fn();
const logged = vi.fn();
const event = (slug: string) =>
  ({
    params: { slug },
    locals: {
      // The api answers over the mocked reader.
      env: apiOver(actorsOnly()),
      log: { info: logged, warn: vi.fn() },
      flags: { isEnabled: flagged },
      getUser: async () => null,
      getProfile: async () => null,
    },
    url: new URL(`https://x.test/s/${slug}`),
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('a system page load', () => {
  beforeEach(() => {
    flagged.mockReset().mockResolvedValue(true);
    logged.mockClear();
    vi.mocked(readSystemPage).mockReset();
  });

  it('answers 404 while the directory is off, for visitors too', async () => {
    flagged.mockResolvedValue(false);
    await expect(run(event('tormenta-20'))).rejects.toMatchObject({ status: 404 });
    expect(flagged).toHaveBeenCalledWith('api_directory_systems', {});
    expect(readSystemPage).not.toHaveBeenCalled();
  });

  it('answers 404 for a system that is not approved, with a code in the log', async () => {
    vi.mocked(readSystemPage).mockResolvedValue(null);
    await expect(run(event('sugestao'))).rejects.toMatchObject({ status: 404 });
    expect(logged).toHaveBeenCalledWith('system not found', { code: 'system_not_found' });
  });

  it('moves a merged system to the one it was merged into, permanently', async () => {
    vi.mocked(readSystemPage).mockResolvedValue({ redirectTo: 'call-of-cthulhu' });
    await expect(run(event('cthulhu-antigo'))).rejects.toMatchObject({
      status: 301,
      location: '/s/call-of-cthulhu',
    });
  });
});
