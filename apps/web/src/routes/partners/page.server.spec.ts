import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { listPartners } from '$lib/server/partners/service';
import { load } from './+page.server';

vi.mock('$lib/server/partners/service', () => ({
  listPartners: vi.fn(),
  filePartnerReport: vi.fn(),
  withdrawPartner: vi.fn(),
}));

const SUBMITTER = '00000000-0000-4000-8000-0000000000aa';
const card = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Taverna do Dado',
  description: null,
  logoPath: 'partners/x/a.png',
  siteUrl: 'https://taverna.example',
  couponCode: null,
  couponDescription: null,
  pending: false,
  submitterId: SUBMITTER,
  links: [],
};

const visit = (profile: { id: string; role: string; status: string } | null, search = '') =>
  ({
    locals: { db: {}, getProfile: async () => profile },
    url: new URL(`https://x.test/partners${search}`),
    platform: undefined,
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the partners page load', () => {
  it("never sends the submitter's account id to the browser", async () => {
    vi.mocked(listPartners).mockResolvedValue({ cards: [card], total: 1, pages: 1 } as never);
    const data = await run(visit(null));
    expect(JSON.stringify(data)).not.toContain(SUBMITTER);
    expect(data.cards[0]).toMatchObject({ canEdit: false, canReport: false });
  });

  it('lets the submitter edit their card but not report it, and others report but not edit', async () => {
    vi.mocked(listPartners).mockResolvedValue({ cards: [card], total: 1, pages: 1 } as never);
    const own = await run(visit({ id: SUBMITTER, role: 'member', status: 'active' }));
    expect(own.cards[0]).toMatchObject({ canEdit: true, canReport: false });
    const other = await run(visit({ id: 'other', role: 'member', status: 'active' }));
    expect(other.cards[0]).toMatchObject({ canEdit: false, canReport: true });
  });

  it('does not offer to report a card that still waits for review', async () => {
    vi.mocked(listPartners).mockResolvedValue({
      cards: [{ ...card, pending: true }],
      total: 1,
      pages: 1,
    } as never);
    const data = await run(visit({ id: 'other', role: 'member', status: 'active' }));
    expect(data.cards[0].canReport).toBe(false);
  });

  it('answers 404 for a page past the last', async () => {
    vi.mocked(listPartners).mockResolvedValue(null);
    await expect(run(visit(null, '?page=9'))).rejects.toMatchObject({ status: 404 });
  });
});
