import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Invalid } from '$lib/server/errors';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { sendAnnouncement } from '$lib/server/notifications/announcements';
import { actions } from './+page.server';

vi.mock('$lib/server/notifications/announcements', () => ({
  sendAnnouncement: vi.fn(),
  audienceSizes: vi.fn(async () => ({ all_active_users: 0, game_masters: 0, active_players: 0 })),
  listAnnouncements: vi.fn(async () => []),
}));
vi.mock('$lib/server/events/dispatcher', () => ({ dispatchEvent: vi.fn() }));

const admin = { id: 'admin', role: 'admin', status: 'active' };
const valid = {
  title: 'Manutenção no sábado',
  body: 'Fora do ar das 2h às 4h.',
  tone: 'warning',
  audience: 'all_active_users',
};

function event(form: Record<string, string>) {
  const after: ((db: unknown) => Promise<unknown>)[] = [];
  return {
    after,
    event: {
      locals: {
        db: {},
        getUser: async () => ({ id: 'admin' }),
        getProfile: async () => ({ ...admin, username: 'admin' }),
        afterResponse: (task: (db: unknown) => Promise<unknown>) => void after.push(task),
      },
      url: new URL('https://x.test/admin/notifications'),
      request: new Request('https://x.test/admin/notifications', {
        method: 'POST',
        body: new URLSearchParams(form),
      }),
    } as unknown as RequestEvent,
  };
}

const send = (e: RequestEvent) =>
  (actions.default as unknown as (e: RequestEvent) => Promise<unknown>)(e);

/** The action's answer: a form (with a message or errors) or the redirect it threw. */
async function answer(e: RequestEvent) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- whatever the action returns
    return { result: (await send(e)) as any };
  } catch (thrown) {
    return { location: (thrown as { location?: string }).location };
  }
}

beforeEach(() => vi.clearAllMocks());

describe('the send action', () => {
  it('asks to confirm first, saying how many it reaches, and sends nothing', async () => {
    vi.mocked(sendAnnouncement).mockResolvedValueOnce({
      step: 'confirm',
      count: 42,
      recipient: null,
    });
    const { event: e, after } = event(valid);

    const { result } = await answer(e);

    expect(result.form.message).toEqual({ code: 'confirm', count: 42 });
    expect(vi.mocked(sendAnnouncement).mock.calls[0][2]).toMatchObject({
      ...valid,
      confirmed: false,
    });
    expect(after).toHaveLength(0);
  });

  it('once confirmed, sends it, delivers after the response and comes back to the page', async () => {
    vi.mocked(sendAnnouncement).mockResolvedValueOnce({ step: 'sent', count: 42, eventId: 'ev1' });
    const { event: e, after } = event({ ...valid, confirmed: 'true' });

    expect(await answer(e)).toEqual({ location: '/admin/notifications' });
    expect(vi.mocked(sendAnnouncement).mock.calls[0][2]).toMatchObject({ confirmed: true });

    expect(after).toHaveLength(1);
    await after[0]({});
    expect(dispatchEvent).toHaveBeenCalledWith({}, expect.anything(), 'ev1');
  });

  it('refuses a missing title or body, and a link that leaves the site, before sending', async () => {
    const { event: e } = event({
      ...valid,
      title: ' ',
      body: '',
      link: 'https://evil.example',
    });

    const { result } = await answer(e);

    expect(result.status).toBe(400);
    expect(result.data.form.errors).toMatchObject({
      title: expect.any(Array),
      body: expect.any(Array),
      link: ['not_site_path'],
    });
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('asks for the person when the audience is one person', async () => {
    const { event: e } = event({ ...valid, audience: 'specific_user' });

    const { result } = await answer(e);

    expect(result.data.form.errors.recipient).toEqual(['required']);
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('says so when the person is not found, or the audience is empty', async () => {
    vi.mocked(sendAnnouncement).mockRejectedValueOnce(new Invalid('recipient', 'not_found'));
    const person = await answer(
      event({ ...valid, audience: 'specific_user', recipient: 'x' }).event,
    );
    expect(person.result.data.form.errors.recipient).toEqual(['not_found']);

    vi.mocked(sendAnnouncement).mockRejectedValueOnce(new Invalid('audience', 'empty'));
    const empty = await answer(event(valid).event);
    expect(empty.result.data.form.message).toEqual({ code: 'empty' });
  });
});
