import { describe, expect, it, vi } from 'vitest';
import { decideViaApi } from './api-decide';

const actor = '00000000-0000-4000-8000-0000000006a1';
const locals = (fetch?: (request: Request) => Promise<Response>) =>
  ({
    env: fetch ? { API: { fetch } } : {},
    log: { warn: vi.fn() },
  }) as unknown as App.Locals;
const decide = (l: App.Locals) =>
  decideViaApi(l, '/v1/admin/moderation/partner.approve', actor, { id: 'p' });

describe('decideViaApi', () => {
  it('returns the events the api wrote, from either answer shape', async () => {
    const many = locals(async () => Response.json({ eventIds: ['a', 'b'] }));
    const one = locals(async () => Response.json({ eventId: 'c' }));

    expect(await decide(many)).toEqual({ kind: 'done', eventIds: ['a', 'b'] });
    expect(await decide(one)).toEqual({ kind: 'done', eventIds: ['c'] });
  });

  it("turns the api's refusals into what the form shows, once", async () => {
    const invalid = locals(async () =>
      Response.json({ error: 'invalid', field: 'id', message: 'closed' }, { status: 400 }),
    );
    const limited = locals(async () => Response.json({ error: 'rate_limited' }, { status: 429 }));
    const forbidden = locals(async () => Response.json({ error: 'forbidden' }, { status: 403 }));

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

  it('answers 503 when the api is unreachable or fails: nothing is decided here', async () => {
    const down = locals();
    const broken = locals(async () => {
      throw new Error('boom');
    });
    const failing = locals(async () => Response.json({ error: 'internal_error' }, { status: 500 }));

    for (const l of [down, broken, failing])
      await expect(decide(l)).rejects.toMatchObject({ status: 503 });
  });
});
