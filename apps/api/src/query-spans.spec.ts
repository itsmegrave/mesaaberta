import { beforeEach, describe, expect, it, vi } from 'vitest';

const span = { setStatus: vi.fn(), end: vi.fn() };
const active = vi.fn();
const start = vi.fn(() => span);
vi.mock('@sentry/cloudflare', () => ({
  getActiveSpan: () => active(),
  startInactiveSpan: (options: unknown) => start(options),
}));

const { querySpans } = await import('./query-spans');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('querySpans', () => {
  it('opens a db span named by the query and ends it when the query settles', () => {
    active.mockReturnValue({});
    const done = querySpans('select "id" from "profiles" where "id" = $1');

    expect(start).toHaveBeenCalledWith({
      op: 'db',
      name: 'select "id" from "profiles" where "id" = $1',
      attributes: { 'db.system': 'postgresql', 'db.operation.name': 'select' },
    });
    done?.();
    expect(span.end).toHaveBeenCalledOnce();
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  it('marks a failed query', () => {
    active.mockReturnValue({});
    querySpans('insert into x values ($1)')?.(new Error('duplicate'));
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: 'internal_error' });
    expect(span.end).toHaveBeenCalledOnce();
  });

  it('records nothing outside a traced request', () => {
    active.mockReturnValue(undefined);
    expect(querySpans('select 1')).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });
});
