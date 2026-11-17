import { describe, expect, it } from 'vitest';
import { connectionStringFrom } from './client';

const local = 'postgres://user:pass@localhost:5432/mesaaberta';
const hyperdrive = 'postgres://user:pass@hyperdrive.example:5432/mesaaberta';

describe('connectionStringFrom', () => {
  it('prefers the Hyperdrive binding over DATABASE_URL', () => {
    expect(
      connectionStringFrom({ HYPERDRIVE: { connectionString: hyperdrive }, DATABASE_URL: local }),
    ).toBe(hyperdrive);
  });

  it('falls back to DATABASE_URL, and to nothing at all', () => {
    expect(connectionStringFrom({ DATABASE_URL: local })).toBe(local);
    expect(connectionStringFrom({})).toBeUndefined();
    expect(connectionStringFrom(undefined)).toBeUndefined();
  });

  it('treats an empty DATABASE_URL as not configured', () => {
    expect(connectionStringFrom({ DATABASE_URL: '' })).toBeUndefined();
  });
});
