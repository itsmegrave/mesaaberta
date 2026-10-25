import { describe, expect, it } from 'vitest';
import { registrationError } from './registration-errors';

describe('registrationError', () => {
  it('says the GM has direct messages off instead of the generic failure', () => {
    expect(registrationError('direct_messages_off')).toBe(
      'Quem mestra esta mesa não recebe mensagens diretas agora.',
    );
  });

  it('falls back to the generic failure for a code it does not know', () => {
    expect(registrationError('something_else')).toBe(registrationError('other'));
  });
});
