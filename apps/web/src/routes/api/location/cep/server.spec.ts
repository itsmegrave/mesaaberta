import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupCep } from '@mesaaberta/core/server/location/cep';
import { recordAttempt } from '@mesaaberta/core/server/auth/attempt-limit';
import { RateLimited } from '@mesaaberta/core/server/errors';
import { apiOver, actorsOnly } from '#lib/server/db/test-api.js';
import { GET } from './+server';
vi.mock('@mesaaberta/core/server/location/cep', () => ({ lookupCep: vi.fn() }));
vi.mock('@mesaaberta/core/server/auth/attempt-limit', () => ({ recordAttempt: vi.fn() }));
const run = (value: string, user: unknown = { id: 'ana' }) => {
  const setHeaders = vi.fn();
  const event = {
    locals: {
      getUser: async () => user,
      env: apiOver(actorsOnly([{ id: 'ana', role: 'member', status: 'active' }])),
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    },
    url: new URL('https://x.test/api/location/cep?value=' + value),
    setHeaders,
  } as unknown as RequestEvent;
  return { result: GET(event as Parameters<typeof GET>[0]), setHeaders };
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(recordAttempt).mockResolvedValue();
});
describe('authenticated CEP endpoint', () => {
  it('normalizes and returns an address after the per-user limit', async () => {
    const address = {
      status: 'found' as const,
      place: { neighbourhood: null, city: 'São Paulo', state: 'SP' },
    };
    vi.mocked(lookupCep).mockResolvedValue(address);
    const { result, setHeaders } = run('01001-000');
    expect(await (await result).json()).toEqual(address);
    expect(lookupCep).toHaveBeenCalledWith(expect.anything(), '01001000', expect.anything());
    expect(recordAttempt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'cep_lookup' }),
      'ana',
    );
    expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
  });
  it('rejects unauthenticated and malformed requests before provider calls', async () => {
    await expect(run('01001000', null).result).rejects.toMatchObject({ status: 401 });
    await expect(run('abc').result).rejects.toMatchObject({ status: 400 });
    expect(lookupCep).not.toHaveBeenCalled();
  });
  it('reports an outage as a failure rather than a cacheable missing address', async () => {
    vi.mocked(lookupCep).mockResolvedValue({ status: 'unavailable' });
    await expect(run('01001000').result).rejects.toMatchObject({ status: 503 });
  });
  it('honors throttling without contacting ViaCEP', async () => {
    vi.mocked(recordAttempt).mockRejectedValueOnce(new RateLimited(30));
    const { result, setHeaders } = run('01001000');
    await expect(result).rejects.toMatchObject({ status: 429 });
    expect(setHeaders).toHaveBeenCalledWith({ 'retry-after': '30' });
    expect(lookupCep).not.toHaveBeenCalled();
  });
});
