import { describe, expect, it } from 'vitest';
import { eventFilters, forceSchema } from './event-filters';

describe('eventFilters', () => {
  it('opens on the failed events, on the first page', () => {
    expect(eventFilters(new URLSearchParams())).toMatchObject({
      status: 'failed',
      type: '',
      page: 1,
    });
  });

  it('reads a state, a type and a page, and falls back for anything else', () => {
    expect(
      eventFilters(new URLSearchParams('status=pending&type=TableCreated&page=3')),
    ).toMatchObject({
      status: 'pending',
      type: 'TableCreated',
      page: 3,
    });
    expect(eventFilters(new URLSearchParams('status=x&page=0'))).toMatchObject({
      status: 'failed',
      page: 1,
    });
  });
});

describe('forceSchema', () => {
  it('wants the id of an event', () => {
    expect(forceSchema.safeParse({ id: crypto.randomUUID() }).success).toBe(true);
    expect(forceSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});
