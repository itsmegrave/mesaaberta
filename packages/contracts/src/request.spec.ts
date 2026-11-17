import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, describe, expect, it } from 'vitest';
import { currentRequestId, requestIdFrom, setRequestContextStore, withRequestId } from './request';

afterEach(() => setRequestContextStore(null));

describe('requestIdFrom', () => {
  it('takes a uuid or a cf-ray, and nothing else', () => {
    expect(requestIdFrom('6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f')).toBe(
      '6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f',
    );
    expect(requestIdFrom('8a1b2c3d4e5f6789-GRU')).toBe('8a1b2c3d4e5f6789-GRU');
    for (const value of [null, undefined, '', 'ana@example.com', 'a'.repeat(200), 'x\ny'])
      expect(requestIdFrom(value)).toBeUndefined();
  });
});

describe('withRequestId', () => {
  it('names the request to everything it awaits, and only inside it', async () => {
    setRequestContextStore(new AsyncLocalStorage());
    const seen = await withRequestId('8a1b2c3d4e5f6789-GRU', async () => {
      await Promise.resolve();
      return currentRequestId();
    });

    expect(seen).toBe('8a1b2c3d4e5f6789-GRU');
    expect(currentRequestId()).toBeUndefined();
  });

  it('still runs the work without a store, with no id', () => {
    expect(withRequestId('8a1b2c3d4e5f6789-GRU', () => currentRequestId())).toBeUndefined();
  });
});
