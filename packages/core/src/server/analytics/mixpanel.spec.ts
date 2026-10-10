import { describe, expect, it, vi } from 'vitest';
import { mixpanelProvider, mixpanelRecord } from './mixpanel';
import { analyticsHandler } from './index';
import { toAnalyticsEvent } from './product-events';
import type { StoredEvent } from '../events/types';

const event: StoredEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  type: 'TableCreated',
  payload: {
    tableId: '33333333-3333-4333-8333-333333333333',
    slug: 'private-text',
    title: 'private-text',
  },
  createdAt: new Date('2026-09-30T12:00:00Z'),
  attempts: 0,
};
const db = {
  select: () => ({ from: () => ({ where: async () => [{ capacity: 5 }] }) }),
} as never;
const deliver = async (send: typeof fetch, item = event) => {
  const provider = mixpanelProvider({ MIXPANEL_TOKEN: 'test-token' }, send)!;
  await analyticsHandler(provider).handle(item, db);
};
describe('Mixpanel event forwarding', () => {
  it('keeps the recorded handler name and sends only opaque ids and stable insert/time values, even on retries', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ status: 'OK', num_records_imported: 1 })),
      );
    expect(analyticsHandler(mixpanelProvider({ MIXPANEL_TOKEN: 't' })!).name).toBe(
      'mixpanel-product-events-v1',
    );
    await deliver(send);
    const first = send.mock.calls.map(([, init]) => init?.body);
    await deliver(send, { ...event, attempts: 3 });
    // A retry resends identical bodies, so the provider deduplicates on `$insert_id`.
    expect(send.mock.calls.slice(first.length).map(([, init]) => init?.body)).toEqual(first);
    expect(JSON.parse(first[0] as string)).toEqual([mixpanelRecord(toAnalyticsEvent(event)!)]);
    expect(first.join()).not.toMatch(/private-text|test-token/);
    expect(send.mock.calls[0][0]).toBe('https://api.mixpanel.com/import?strict=1');
  });
  it('does not forward connection IPs, administrative content or events without an actor', () => {
    expect(
      toAnalyticsEvent({ ...event, type: 'UserSignedIn', payload: { ip: '1.2.3.4' } }),
    ).toBeNull();
    expect(toAnalyticsEvent({ ...event, actorId: null })).toBeNull();
    expect(mixpanelProvider(undefined)).toBeNull();
  });
  it('lets the outbox retry rejected events without leaking provider response text', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret echoed', { status: 503 }));
    await expect(deliver(send)).rejects.toThrow('Mixpanel import failed: HTTP 503');
  });
  it('rejects a 200 response when the provider did not accept the event', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'Bad Request', num_records_imported: 0 })),
      );
    await expect(deliver(send)).rejects.toThrow('Mixpanel import rejected');
  });
  it('surfaces network failure for retry without succeeding the handler', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('network unavailable'));
    await expect(deliver(send)).rejects.toThrow('network unavailable');
  });
});
