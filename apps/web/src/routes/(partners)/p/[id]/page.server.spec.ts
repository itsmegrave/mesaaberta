import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPartnerPage } from '@mesaaberta/core/server/partners/service';
import { partnerConnections } from '@mesaaberta/core/server/directories/links';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/partners/service', async (original) => ({
  ...(await original<typeof import('@mesaaberta/core/server/partners/service')>()),
  readPartnerPage: vi.fn(),
}));

vi.mock('@mesaaberta/core/server/directories/links', () => ({ partnerConnections: vi.fn() }));

const ANA = '00000000-0000-4000-8000-0000000000aa';
const BIA = '00000000-0000-4000-8000-0000000000bb';
const PARTNER = '00000000-0000-4000-8000-000000000001';
const partner = {
  id: PARTNER,
  name: 'Taverna do Dado',
  description: 'Loja de jogos',
  types: ['shop'],
  logoPath: `partners/${ANA}/a.png`,
  siteUrl: 'https://taverna.example',
  couponCode: 'MESA10',
  couponDescription: null,
  pending: false,
  ownerIds: [ANA],
  links: [],
};

const flagged = vi.fn();
function event(viewer: string | null) {
  return {
    params: { id: PARTNER },
    locals: {
      env: apiOver(actorsOnly([ANA, BIA].map((id) => ({ id, role: 'member', status: 'active' }))), {
        SUPABASE_URL: 'https://sb.test',
      }),
      log: { warn: vi.fn(), info: vi.fn() },
      flags: { isEnabled: flagged },
      getUser: async () => (viewer ? { id: viewer } : null),
      getProfile: async () => (viewer ? { id: viewer, role: 'member', status: 'active' } : null),
    },
    url: new URL(`https://x.test/p/${PARTNER}`),
  } as unknown as RequestEvent;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

beforeEach(() => {
  vi.clearAllMocks();
  flagged.mockResolvedValue(true);
  vi.mocked(readPartnerPage).mockResolvedValue(
    partner as unknown as Awaited<ReturnType<typeof readPartnerPage>>,
  );
  vi.mocked(partnerConnections).mockResolvedValue({ places: [], gms: [] });
});

describe("a partner's page", () => {
  it('answers 404 while use_directory_links is off', async () => {
    flagged.mockResolvedValue(false);
    await expect(run(event(null))).rejects.toMatchObject({ status: 404 });
    expect(readPartnerPage).not.toHaveBeenCalled();
  });

  it('answers 404 for a partner that is not on the page', async () => {
    vi.mocked(readPartnerPage).mockResolvedValue(null);
    await expect(run(event(BIA))).rejects.toMatchObject({ status: 404 });
  });

  it('keeps who looks after it on the server: it says what the viewer may do', async () => {
    const owner = await run(event(ANA));
    expect(owner.partner).not.toHaveProperty('ownerIds');
    expect(owner.partner).not.toHaveProperty('logoPath');
    expect(owner.partner.logoUrl).toContain(`partners/${ANA}/a.png`);
    expect(owner).toMatchObject({ canEdit: true, canReport: false });
    expect(await run(event(BIA))).toMatchObject({ canEdit: false, canReport: true });
    // A visitor is offered the report through the login.
    expect(await run(event(null))).toMatchObject({ canEdit: false, canReport: true });
  });

  it('lists its places and who mestra there, pictures as URLs', async () => {
    vi.mocked(partnerConnections).mockResolvedValue({
      places: [
        {
          slug: 'taverna',
          name: 'Taverna',
          kind: 'game_cafe',
          neighbourhood: null,
          city: 'Recife',
          state: 'PE',
          description: null,
          features: [],
          imagePath: 'places/t.png',
          openTables: 2,
          partner: true,
        },
      ],
      gms: [{ partnerId: PARTNER, username: 'ana', name: null, avatarPath: null, avatarUrl: null }],
    });
    const page = await run(event(null));
    expect(page.places).toMatchObject([{ slug: 'taverna', partner: true }]);
    expect(page.places[0].imageUrl).toContain('places/t.png');
    expect(page.gms).toEqual([{ username: 'ana', name: null, avatarUrl: null }]);
  });
});
