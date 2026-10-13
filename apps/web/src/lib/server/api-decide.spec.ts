import { describe, expect, it, vi } from 'vitest';
import { decideViaApi } from './api-decide';

const actor = '00000000-0000-4000-8000-0000000006a1';
const locals = (flag: boolean, fetch?: (request: Request) => Promise<Response>) =>
  ({
    env: fetch ? { API: { fetch } } : {},
    flags: { isEnabled: vi.fn(async () => flag) },
    log: { warn: vi.fn() },
  }) as unknown as App.Locals;
const decide = (l: App.Locals) =>
  decideViaApi(l, 'api_admin_moderation', '/v1/admin/moderation/partner.approve', actor, {
    id: 'p',
  });

describe('decideViaApi', () => {
  it('leaves the decision here with the flag off, never calling the api', async () => {
    const fetch = vi.fn();
    expect(await decide(locals(false, fetch))).toEqual({ kind: 'fallback' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the events the api wrote, from either answer shape', async () => {
    const many = locals(true, async () => Response.json({ eventIds: ['a', 'b'] }));
    const one = locals(true, async () => Response.json({ eventId: 'c' }));

    expect(await decide(many)).toEqual({ kind: 'done', eventIds: ['a', 'b'] });
    expect(await decide(one)).toEqual({ kind: 'done', eventIds: ['c'] });
  });

  it("turns the api's refusals into what the form shows, once", async () => {
    const invalid = locals(true, async () =>
      Response.json({ error: 'invalid', field: 'id', message: 'closed' }, { status: 400 }),
    );
    const limited = locals(true, async () =>
      Response.json({ error: 'rate_limited' }, { status: 429 }),
    );
    const forbidden = locals(true, async () =>
      Response.json({ error: 'forbidden' }, { status: 403 }),
    );

    expect(await decide(invalid)).toEqual({
      kind: 'refused',
      status: 400,
      field: 'id',
      code: 'closed',
    });
    expect(await decide(limited)).toEqual({
      kind: 'refused',
      status: 429,
      field: '',
      code: 'rate_limited',
    });
    expect(await decide(forbidden)).toEqual({
      kind: 'refused',
      status: 403,
      field: '',
      code: 'forbidden',
    });
  });

  it('falls back when the api is unreachable or fails', async () => {
    const down = locals(true);
    const broken = locals(true, async () => {
      throw new Error('boom');
    });
    const failing = locals(true, async () =>
      Response.json({ error: 'internal_error' }, { status: 500 }),
    );

    expect(await decide(down)).toEqual({ kind: 'fallback' });
    expect(await decide(broken)).toEqual({ kind: 'fallback' });
    expect(await decide(failing)).toEqual({ kind: 'fallback' });
  });
});
