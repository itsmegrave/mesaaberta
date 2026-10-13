import { describe, expect, it } from 'vitest';
import { deleteAccountSchema } from './delete';

describe('deleteAccountSchema', () => {
  it('compares the typed @username without spaces or capitals', () => {
    expect(deleteAccountSchema.parse({ confirm: '  Ana-Maria ' })).toEqual({
      confirm: 'ana-maria',
    });
  });

  it('refuses something far longer than a username', () => {
    expect(deleteAccountSchema.safeParse({ confirm: 'a'.repeat(101) }).success).toBe(false);
  });
});
