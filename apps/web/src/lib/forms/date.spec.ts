import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME, pickerTranslations, safeParse } from './date';

describe('safeParse', () => {
  it('reads a day', () => {
    expect(safeParse('2026-10-10')?.toString()).toBe('2026-10-10');
  });

  it('gives nothing for an empty or a broken day, instead of throwing', () => {
    expect(safeParse('')).toBeUndefined();
    expect(safeParse(undefined)).toBeUndefined();
    expect(safeParse('amanhã')).toBeUndefined();
  });
});

describe('pickerTranslations', () => {
  it("names the picker's buttons and days in Portuguese", () => {
    const words = pickerTranslations(() => 'Abrir');
    expect(words.nextTrigger?.('day')).not.toMatch(/next/i);
    expect(words.presetTrigger?.([])).toBe('');
    expect(words.placeholder?.('pt-BR')).toEqual({ day: 'dd', month: 'mm', year: 'aaaa' });
  });

  it('says when a day cannot be picked', () => {
    const words = pickerTranslations(() => 'Abrir');
    const day = { valueText: '10 de outubro', unavailable: true, disabled: false } as never;
    expect(words.dayCell?.(day)).not.toBe(
      words.dayCell?.({ valueText: '10 de outubro', unavailable: false, disabled: false } as never),
    );
  });

  it("uses the caller's name for the opener", () => {
    expect(pickerTranslations((open) => (open ? 'Fechar' : 'Abrir')).trigger?.(true)).toBe(
      'Fechar',
    );
  });

  it('offers an evening hour', () => {
    expect(DEFAULT_TIME).toMatch(/^\d{2}:\d{2}$/);
  });
});
