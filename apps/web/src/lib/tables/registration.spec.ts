import { describe, expect, it } from 'vitest';
import { JOIN_MESSAGE_MAX, joinSchema } from './registration';

describe('joinSchema', () => {
  it('treats the message as optional', () => {
    expect(joinSchema.parse({}).message).toBe('');
  });

  it('trims the message', () => {
    expect(joinSchema.parse({ message: '  Oi, mestre!  ' }).message).toBe('Oi, mestre!');
  });

  it('accepts a message at the limit and refuses one past it', () => {
    expect(joinSchema.safeParse({ message: 'a'.repeat(JOIN_MESSAGE_MAX) }).success).toBe(true);
    expect(joinSchema.safeParse({ message: 'a'.repeat(JOIN_MESSAGE_MAX + 1) }).success).toBe(false);
  });
});
