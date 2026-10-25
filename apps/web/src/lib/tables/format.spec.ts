import { describe, expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { dateBox, kindLabel, openedLabel, scheduleLabel, seatsLeftLabel } from './format';

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

describe('openedLabel', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

  it('counts from when the table was published', () => {
    expect(openedLabel(ago(0), now)).toBe('Aberta agora');
    expect(openedLabel(ago(12), now)).toBe('Aberta há 12 min');
    expect(openedLabel(ago(5 * 60 + 10), now)).toBe('Aberta há 5 h');
    expect(openedLabel(ago(30 * 60), now)).toBe('Aberta ontem');
    expect(openedLabel(ago(3 * 24 * 60), now)).toBe('Aberta há 3 dias');
  });

  it('reads a date a little ahead of the clock as now', () => {
    expect(openedLabel(ago(-1), now)).toBe('Aberta agora');
  });
});
