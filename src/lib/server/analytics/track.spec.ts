import { describe, expect, it, vi } from 'vitest';
import { createTracker, sourceChannel } from './track';
import type { AnalyticsProvider, AnalyticsProviderFactory } from './provider';
import type { AnalyticsEnv } from './index';

const user = '22222222-2222-4222-8222-222222222222';
const setup = (send = vi.fn(async () => {}), configured = true) => {
  const provider: AnalyticsProvider = { name: 'acme', send };
  const factories: AnalyticsProviderFactory<AnalyticsEnv>[] = [
    () => (configured ? provider : null),
  ];
  const queued: ((db: never) => Promise<unknown>)[] = [];
  const log = { warn: vi.fn() };
  const track = createTracker({
    env: undefined,
    afterResponse: (task) => void queued.push(task as never),
    log: log as never,
    factories,
    now: () => new Date('2026-09-30T12:00:00Z'),
  });
  const flush = () => Promise.all(queued.map((task) => task({} as never)));
  return { track, flush, queued, send, log };
};

describe('request event tracking', () => {
  it('sends after the response, with a fresh insert id and the time of the request', async () => {
    const { track, flush, queued, send } = setup();
    track('player_mesa_detail_viewed', user, { mesa_id: 'm', seat_availability: 2 });
    expect(send).not.toHaveBeenCalled();
    expect(queued).toHaveLength(1);
    await flush();
    expect(send).toHaveBeenCalledWith({
      name: 'player_mesa_detail_viewed',
      distinctId: user,
      insertId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      time: new Date('2026-09-30T12:00:00Z'),
      properties: { mesa_id: 'm', seat_availability: 2, timestamp_utc: '2026-09-30T12:00:00.000Z' },
    });
  });

  it('tracks nobody who is anonymous or has no opaque id, and nothing without a provider', async () => {
    const a = setup();
    a.track('player_browse_mesas_viewed', null, {});
    a.track('player_browse_mesas_viewed', 'not-a-uuid', {});
    expect(a.queued).toHaveLength(0);
    const b = setup(undefined, false);
    b.track('player_browse_mesas_viewed', user, {});
    expect(b.queued).toHaveLength(0);
  });

  it('runs a lookup after the response and sends nothing when it finds nothing', async () => {
    const { track, flush, send } = setup();
    track('player_seat_claim_initiated', user, async () => null);
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('logs a failing provider without throwing, and without the response text', async () => {
    const { track, flush, log } = setup(vi.fn(async () => Promise.reject(new Error('HTTP 503'))));
    track('gm_onboarding_started', user, { onboarding_step: 'profile_setup' });
    await expect(flush()).resolves.toBeDefined();
    expect(log.warn).toHaveBeenCalledWith(
      'analytics.track.failed',
      expect.objectContaining({ event: 'gm_onboarding_started', provider: 'acme' }),
    );
  });
});

describe('sourceChannel', () => {
  const url = new URL('https://mesaaberta.app/tables');
  it('tells direct, internal and external arrivals apart from the Referer alone', () => {
    expect(sourceChannel(null, url)).toBe('direct');
    expect(sourceChannel('https://mesaaberta.app/', url)).toBe('internal_link');
    expect(sourceChannel('https://google.com/search?q=x', url)).toBe('referral');
    expect(sourceChannel('garbage', url)).toBe('direct');
  });
});
