import { describe, expect, it } from 'vitest';
import { streetFromCep } from './cep-street';

describe('streetFromCep', () => {
  it('fills an empty street', () => {
    expect(streetFromCep('', null, 'Avenida Boa Viagem')).toEqual({
      street: 'Avenida Boa Viagem',
      filled: 'Avenida Boa Viagem',
    });
    expect(streetFromCep('  ', null, 'Rua da Aurora')).toMatchObject({ street: 'Rua da Aurora' });
  });

  it('replaces what an earlier CEP filled, or clears it for a town-wide CEP', () => {
    expect(streetFromCep('Rua da Aurora', 'Rua da Aurora', 'Rua do Sol')).toEqual({
      street: 'Rua do Sol',
      filled: 'Rua do Sol',
    });
    expect(streetFromCep('Rua da Aurora', 'Rua da Aurora', null)).toEqual({
      street: '',
      filled: null,
    });
  });

  it('keeps what the person typed', () => {
    expect(streetFromCep('Rua da Aurora, 120', 'Rua da Aurora', 'Rua do Sol')).toBeNull();
    expect(streetFromCep('Praça do Arsenal, 10', null, 'Rua do Sol')).toBeNull();
  });
});
