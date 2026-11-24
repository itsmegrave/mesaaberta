import { describe, expect, it } from 'vitest';
import { isConnectionLost } from './connection-lost';

const coded = (code: string) => Object.assign(new Error(code), { code });

describe('isConnectionLost', () => {
  it('knows a dropped connection, also when drizzle wrapped it', () => {
    expect(isConnectionLost(coded('CONNECTION_CLOSED'))).toBe(true);
    expect(isConnectionLost(new Error('Failed query', { cause: coded('CONNECTION_ENDED') }))).toBe(
      true,
    );
  });

  it('leaves every other failure alone', () => {
    expect(isConnectionLost(new Error('boom'))).toBe(false);
    expect(isConnectionLost(new Error('Failed query', { cause: coded('23505') }))).toBe(false);
    expect(isConnectionLost(undefined)).toBe(false);
  });
});
