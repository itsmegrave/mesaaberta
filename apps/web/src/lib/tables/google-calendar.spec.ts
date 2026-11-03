import { describe, expect, it } from 'vitest';
import { googleCalendarHref, type GoogleCalendarTable } from './google-calendar';

const table: GoogleCalendarTable = {
  title: 'A Cripta do Rei Afogado',
  startsAt: new Date('2026-11-08T22:00:00Z'), // 19:00 in São Paulo
  durationMinutes: 240,
  timezone: 'America/Sao_Paulo',
  recurrence: null,
  until: null,
};
const url = 'https://mesaaberta.app/t/a-cripta';
const paramsOf = (href: string) => new URL(href).searchParams;

describe('googleCalendarHref', () => {
  it('fills a one-shot in with its wall-clock times, zone and link', () => {
    const href = googleCalendarHref(table, url);
    expect(href.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    const params = paramsOf(href);
    expect(params.get('action')).toBe('TEMPLATE');
    expect(params.get('text')).toBe('A Cripta do Rei Afogado');
    expect(params.get('dates')).toBe('20261108T190000/20261108T230000');
    expect(params.get('ctz')).toBe('America/Sao_Paulo');
    expect(params.get('details')).toBe(url);
    expect(params.has('recur')).toBe(false);
  });

  it('crosses midnight in the table zone', () => {
    const late = { ...table, startsAt: new Date('2026-11-09T01:30:00Z'), durationMinutes: 180 };
    expect(paramsOf(googleCalendarHref(late, url)).get('dates')).toBe(
      '20261108T223000/20261109T013000',
    );
  });

  it('passes a weekly rule on, with its end date in UTC', () => {
    const weekly = {
      ...table,
      recurrence: 'FREQ=WEEKLY;INTERVAL=2',
      until: new Date('2027-03-01T02:59:59Z'),
    };
    expect(paramsOf(googleCalendarHref(weekly, url)).get('recur')).toBe(
      'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20270301T025959Z',
    );
  });

  it('leaves out a rule the table form does not write', () => {
    const odd = { ...table, recurrence: 'FREQ=DAILY' };
    expect(paramsOf(googleCalendarHref(odd, url)).has('recur')).toBe(false);
  });
});
