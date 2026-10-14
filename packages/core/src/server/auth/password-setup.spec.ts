import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { carriedAttempts } from './password-setup';

describe('carriedAttempts', () => {
  it('binds the instant as a string, which the production driver can send', () => {
    const { params, sql } = new PgDialect().sqlToQuery(
      carriedAttempts(new Date('2026-10-14T12:00:00Z')),
    );

    expect(params.some((value) => value instanceof Date)).toBe(false);
    expect(params).toContain('2026-10-14T11:00:00.000Z');
    expect(sql).toContain('::timestamptz');
  });
});
