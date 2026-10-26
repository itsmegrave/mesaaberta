import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '@mesaaberta/core/server/errors';
import { invitePartnerOwner, removePartnerOwner } from '@mesaaberta/core/server/partners/owners';
import { actions } from './+page.server';

vi.mock('@mesaaberta/core/server/partners/owners', () => ({
  invitePartnerOwner: vi.fn(async () => ({ invitationId: 'i', eventIds: ['e1'] })),
  cancelPartnerInvitation: vi.fn(async () => ({ eventIds: [] })),
  removePartnerOwner: vi.fn(async () => ({ eventIds: ['e2'] })),
  listPartnerOwners: vi.fn(),
}));
vi.mock('@mesaaberta/core/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const PARTNER = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-0000000000aa';
const BRUNO = '00000000-0000-4000-8000-0000000000bb';

function event(form: Record<string, string>, { flagOn = true } = {}) {
  const after: unknown[] = [];
  return {
    after,
    event: {
      locals: {
        db: {},
        env: {},
        flags: { isEnabled: async () => flagOn },
        log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
        getUser: async () => ({ id: ANA }),
        getProfile: async () => ({ id: ANA, role: 'member', status: 'active', username: 'ana' }),
        afterResponse: (task: unknown) => void after.push(task),
      },
      params: { id: PARTNER },
      url: new URL(`https://x.test/p/${PARTNER}/edit`),
      request: new Request(`https://x.test/p/${PARTNER}/edit`, {
        method: 'POST',
        body: new URLSearchParams(form),
      }),
    } as unknown as RequestEvent,
  };
}

type Run = (e: RequestEvent) => Promise<unknown>;
async function answer(name: keyof typeof actions, e: RequestEvent) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the action returns
    return { result: (await (actions[name] as unknown as Run)(e)) as any };
  } catch (thrown) {
    return { location: (thrown as { location?: string }).location };
  }
}

beforeEach(() => vi.clearAllMocks());

describe('"Quem cuida do parceiro" on the edit page', () => {
  it('invites by @username for this partner and dispatches the event after the response', async () => {
    const { event: e, after } = event({ username: ' @Bruno ' });
    await answer('invite', e);
    expect(invitePartnerOwner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ANA }),
      PARTNER,
      'bruno',
    );
    expect(after).toHaveLength(1);
  });

  it('refuses while use_partner_owners is off for the person', async () => {
    const { result } = await answer(
      'invite',
      event({ username: 'bruno' }, { flagOn: false }).event,
    );
    expect(result.status).toBe(403);
    expect(result.data.form.message).toEqual({ code: 'forbidden' });
    expect(invitePartnerOwner).not.toHaveBeenCalled();
  });

  it('answers a refusal with its code on the field', async () => {
    vi.mocked(invitePartnerOwner).mockRejectedValueOnce(new Invalid('username', 'unavailable'));
    const { result } = await answer('invite', event({ username: 'ninguem' }).event);
    expect(result.status).toBe(400);
    expect(result.data.form.errors.username).toEqual(['unavailable']);
  });

  it('takes another account off, and leaving takes the person to /p', async () => {
    await answer('removeOwner', event({ profileId: BRUNO }).event);
    expect(removePartnerOwner).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      PARTNER,
      BRUNO,
    );
    const { location } = await answer(
      'leave',
      event({ profileId: BRUNO }, { flagOn: false }).event,
    );
    // Leaving is always one's own row, whatever the form says, and works with the flag off.
    expect(removePartnerOwner).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      PARTNER,
      ANA,
    );
    expect(location).toBe('/p');
  });
});
