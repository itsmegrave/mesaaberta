import { describe, expect, it, vi } from 'vitest';
import { analyticsHandlers } from './index';
import type { AnalyticsEnv } from './index';
import type { AnalyticsProvider, AnalyticsProviderFactory } from './provider';
import type { StoredEvent } from '../events/types';

const event: StoredEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  type: 'PlayerJoined',
  payload: { tableId: '33333333-3333-4333-8333-333333333333' } as never,
  createdAt: new Date('2026-09-30T12:00:00Z'),
  attempts: 0,
};
const fake = (
  name: string,
  send = vi.fn(async () => {}),
): AnalyticsProviderFactory<AnalyticsEnv> => {
  const provider: AnalyticsProvider = { name, send };
  return () => provider;
};

describe('analytics providers', () => {
  it('runs a new provider through the same filter without touching the handlers', async () => {
    const send = vi.fn(async () => {});
    const [handler] = analyticsHandlers(undefined, [fake('acme', send)]);
    expect(handler.name).toBe('acme-product-events-v1');
    await handler.handle(event, null as never);
    expect(send).toHaveBeenCalledWith({
      name: 'PlayerJoined',
      distinctId: event.actorId,
      insertId: event.id,
      time: event.createdAt,
      properties: { tableId: '33333333-3333-4333-8333-333333333333' },
    });
  });
  it('gives each provider its own handler so one failing does not block the other', () => {
    const names = analyticsHandlers(undefined, [fake('a'), fake('b')]).map((h) => h.name);
    expect(names).toEqual(['a-product-events-v1', 'b-product-events-v1']);
  });
  it('adds no handler for a provider that is not configured, and never sends filtered events', async () => {
    expect(analyticsHandlers(undefined)).toEqual([]);
    const send = vi.fn(async () => {});
    const [handler] = analyticsHandlers(undefined, [fake('acme', send)]);
    await handler.handle({ ...event, actorId: null }, null as never);
    expect(send).not.toHaveBeenCalled();
  });
});
