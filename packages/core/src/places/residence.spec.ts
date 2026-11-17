import { describe, expect, it } from 'vitest';
import { looksResidential } from './residence';

describe('looksResidential', () => {
  it.each([
    ['Rua das Flores, 120', 'Apto 302'],
    ['Rua das Flores, 120', 'ap 12'],
    ['Rua das Flores, 120', 'Bloco B'],
    ['Rua das Flores, 120', 'bl. 3, ap. 41'],
    ['Rua das Flores, 120, casa 2', ''],
    ['Av. Brasil, 900', 'Condomínio Jardim'],
    ['Av. Brasil, 900', 'Residencial Primavera'],
    ['Av. Brasil, 900 apartamento 5', null],
  ])('flags %s / %s', (street, complement) => {
    expect(looksResidential(street, complement)).toBe(true);
  });

  it.each([
    ['Av. Boa Viagem, 100', ''],
    ['Rua da Aurora, 50', 'Loja 12'],
    ['Rua da Aurora, 50', 'Sala 304'],
    ['Praça da Casa Forte, 10', '2º andar'],
    ['Rua do Apolo, 30', 'Térreo'],
    ['Av. Paulista, 1000', 'Shopping, piso L2'],
  ])('lets %s / %s through', (street, complement) => {
    expect(looksResidential(street, complement)).toBe(false);
  });
});
