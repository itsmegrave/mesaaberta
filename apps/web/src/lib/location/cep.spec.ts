import { describe, expect, it } from 'vitest';
import { areaOf, formatCep, normalizeCep } from './cep';

describe('normalizeCep', () => {
  it('keeps the 8 digits whatever the punctuation', () => {
    expect(normalizeCep('50030-230')).toBe('50030230');
    expect(normalizeCep(' 50.030230 ')).toBe('50030230');
  });

  it('refuses anything that is not 8 digits', () => {
    expect(normalizeCep('5003023')).toBeNull();
    expect(normalizeCep('500302301')).toBeNull();
    expect(normalizeCep('')).toBeNull();
  });
});

describe('formatCep and areaOf', () => {
  it('show a CEP and a place the usual way', () => {
    expect(formatCep('50030230')).toBe('50030-230');
    expect(areaOf({ neighbourhood: 'Boa Viagem', city: 'Recife', state: 'PE' })).toBe(
      'Boa Viagem, Recife - PE',
    );
    expect(areaOf({ neighbourhood: null, city: 'Recife', state: 'PE' })).toBe('Recife - PE');
  });
});
