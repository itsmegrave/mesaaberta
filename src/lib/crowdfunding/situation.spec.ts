import { describe, expect, it } from 'vitest';
import { situationOf } from './situation';

const campaign = { startsOn: '2026-10-10', endsOn: '2026-10-20' };
const at = (day: string) => new Date(`${day}T15:00:00Z`);

describe('situationOf', () => {
  it('counts the days left of a running campaign', () => {
    expect(situationOf(campaign, 'pt-BR', at('2026-10-12'))).toEqual({
      text: 'Termina em 8 dias',
      warn: false,
    });
  });

  it('warns in the last days, and says so on the last day itself', () => {
    expect(situationOf(campaign, 'pt-BR', at('2026-10-18'))).toEqual({
      text: 'Últimos 2 dias',
      warn: true,
    });
    expect(situationOf(campaign, 'pt-BR', at('2026-10-20'))).toEqual({
      text: 'Termina hoje',
      warn: true,
    });
  });

  it('says when an upcoming one opens and when an ended one ended, with no warning', () => {
    expect(situationOf(campaign, 'pt-BR', at('2026-10-09'))).toEqual({
      text: 'Começa amanhã',
      warn: false,
    });
    expect(situationOf(campaign, 'pt-BR', at('2026-10-05')).text).toBe('Começa em 5 dias');
    const ended = situationOf(campaign, 'pt-BR', at('2026-11-01'));
    expect(ended.warn).toBe(false);
    expect(ended.text).toMatch(/^Encerrou em .*2026/);
  });
});
