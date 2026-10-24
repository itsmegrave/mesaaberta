import { describe, expect, it, vi } from 'vitest';
import { withQueryTiming } from './query-timing';

/** A client shaped like postgres.js: callable, with `unsafe` and `begin`, and a lazy query. */
function fakeClient() {
  const query = (result: unknown, fail = false) => {
    const q = {
      then(ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
        return (fail ? Promise.reject(result) : Promise.resolve(result)).then(ok, bad);
      },
      values() {
        return q;
      },
    };
    return q;
  };
  const client = Object.assign(() => 'tagged', {
    options: { parsers: {} },
    unsafe: vi.fn((text: string) =>
      query(text === 'boom' ? new Error('boom') : [text], text === 'boom'),
    ),
    begin: vi.fn(async (callback: (sql: unknown) => unknown) =>
      callback({ unsafe: (text: string) => query([text]) }),
    ),
    end: vi.fn(async () => undefined),
  });
  return client;
}

describe('withQueryTiming', () => {
  it('reports the time of each awaited query and returns its rows', async () => {
    const seen: number[] = [];
    const client = withQueryTiming(fakeClient(), (seconds) => seen.push(seconds));

    expect(await client.unsafe('select 1')).toEqual(['select 1']);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThanOrEqual(0);
  });

  it('keeps the timing through .values(), which returns the same query', async () => {
    const seen: number[] = [];
    const client = withQueryTiming(fakeClient(), (seconds) => seen.push(seconds));

    expect(await client.unsafe('select 2').values()).toEqual(['select 2']);
    expect(seen).toHaveLength(1);
  });

  it('times the queries inside a transaction through the transaction callback client', async () => {
    const seen: number[] = [];
    const client = withQueryTiming(fakeClient(), (seconds) => seen.push(seconds));

    const rows = await client.begin(async (sql) => sql.unsafe('select 3'));

    expect(rows).toEqual(['select 3']);
    expect(seen).toHaveLength(1);
  });

  it('reports a failed query once and rethrows the error', async () => {
    const seen: number[] = [];
    const client = withQueryTiming(fakeClient(), (seconds) => seen.push(seconds));

    await expect(client.unsafe('boom')).rejects.toThrow('boom');
    expect(seen).toHaveLength(1);
  });

  it('passes every other property and call through untouched', async () => {
    const inner = fakeClient();
    const client = withQueryTiming(inner, () => undefined);

    expect(client.options).toBe(inner.options);
    await client.end();
    expect(inner.end).toHaveBeenCalledOnce();
    expect(client()).toBe('tagged');
  });
});
