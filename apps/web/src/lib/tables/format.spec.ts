import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { dateBox, kindLabel, scheduleLabel, seatsLeftLabel } from './format';

describe('kindLabel', () => {
  it('names each kind', () => {
    expect(kindLabel('campaign')).toBe('Campanha');
    expect(kindLabel('adventure')).toBe('Aventura');
    expect(kindLabel('one_shot')).toBe('One-shot');
  });
});

describe('scheduleLabel', () => {
  it('says a one-shot meets once and an adventure agrees its dates', () => {
    expect(scheduleLabel('one_shot', null)).toBe('Sessão única');
    expect(scheduleLabel('adventure', null)).toBe(m.table_adventure_schedule());
  });

  it('reads a campaign’s weekly rule', () => {
    expect(scheduleLabel('campaign', 1)).toBe('Toda semana');
    expect(scheduleLabel('campaign', 2)).toBe('A cada 2 semanas');
  });

  it('says nothing for a campaign whose rule the platform does not read', () => {
    // Not "Toda semana": a rule outside FREQ=WEEKLY may well not be weekly.
    expect(scheduleLabel('campaign', null)).toBeNull();
  });
});

describe('seatsLeftLabel', () => {
  it('says the table is full at zero', () => {
    expect(seatsLeftLabel(0)).toBe('Mesa cheia');
    expect(seatsLeftLabel(2)).toBe(m.table_seats_left({ count: 2 }));
  });
});

describe('dateBox', () => {
  it('splits the date in the given zone, without abbreviation dots', () => {
    // 02:00 UTC on Sunday is still Saturday in São Paulo.
    const box = dateBox(new Date('2026-09-27T02:00:00Z'), 'America/Sao_Paulo', 'pt-BR');
    expect(box).toEqual({ weekday: 'sáb', day: '26', month: 'set' });
  });
});
