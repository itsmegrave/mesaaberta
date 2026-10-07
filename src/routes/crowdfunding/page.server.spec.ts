import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { listCrowdfundings } from '$lib/server/crowdfunding/service';
import { load } from './+page.server';

vi.mock('$lib/server/crowdfunding/service', () => ({
  listCrowdfundings: vi.fn(),
  fileCrowdfundingReport: vi.fn(),
}));

const campaign = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Tormenta',
  owner: 'Jambô',
  url: 'https://catarse.me/tormenta',
  platform: 'catarse',
  startsOn: '2026-10-01',
  endsOn: '2026-10-30',
  imagePath: null,
  submitterId: '00000000-0000-4000-8000-0000000000aa',
  submitter: 'ana',
};

// A visitor who is not signed in: no profile, no user.
const anonymous = (search = '') =>
  ({
    locals: { db: {}, getUser: async () => null, getProfile: async () => null },
    url: new URL(`https://x.test/crowdfunding${search}`),
    platform: undefined,
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the crowdfunding list load', () => {
  it('serves a visitor who is not signed in, as the table list does, with no way to report', async () => {
    vi.mocked(listCrowdfundings).mockResolvedValue({
      running: [campaign],
      upcoming: [],
      ended: [],
      endedCount: 0,
      pages: 1,
    } as never);

    const data = await run(anonymous());

    expect(data.signedIn).toBe(false);
    expect(data.running).toHaveLength(1);
    expect(data.running[0]).toMatchObject({ name: 'Tormenta', submitter: 'ana', canReport: false });
  });

  it("never sends the submitter's account id to the browser", async () => {
    vi.mocked(listCrowdfundings).mockResolvedValue({
      running: [campaign],
      upcoming: [],
      ended: [],
      endedCount: 0,
      pages: 1,
    } as never);

    const data = await run(anonymous());

    expect(JSON.stringify(data)).not.toContain(campaign.submitterId);
  });

  it('answers 404 for a page past the last one', async () => {
    vi.mocked(listCrowdfundings).mockResolvedValue(null);

    await expect(run(anonymous('?status=ended&page=9'))).rejects.toMatchObject({ status: 404 });
  });
});
