import { describe, expect, it } from 'vitest';
import { availabilityMask } from '@mesaaberta/core/profile/availability';
import { availabilityLines } from './availability';

describe('availability lines', () => {
  it('lists the days of each part of the day, morning first', () => {
    expect(
      availabilityLines(availabilityMask(['fri-night', 'mon-night', 'sat-afternoon'])),
    ).toEqual(['Tarde: sáb', 'Noite: seg, sex']);
  });

  it('says every day when all seven are on', () => {
    const nights = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => `${day}-night`);
    expect(availabilityLines(availabilityMask(nights))).toEqual(['Noite: todos os dias']);
  });

  it('has no line when nothing was said', () => {
    expect(availabilityLines(0)).toEqual([]);
  });
});
