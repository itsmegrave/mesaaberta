import { describe, expect, it } from 'vitest';
import {
  AVAILABILITY_ALL,
  AVAILABILITY_SLOTS,
  availabilityByPeriod,
  availabilityFilterMask,
  availabilityMask,
  availabilitySchema,
  availabilitySlots,
} from './availability';

describe('availability', () => {
  it('has 21 slots and round-trips through the stored integer', () => {
    expect(AVAILABILITY_SLOTS).toHaveLength(21);
    expect(AVAILABILITY_ALL).toBe(2 ** 21 - 1);
    const slots = ['mon-night', 'sat-afternoon', 'sun-morning'] as const;
    expect(availabilitySlots(availabilityMask(slots))).toEqual(slots);
    expect(availabilityMask(AVAILABILITY_SLOTS)).toBe(AVAILABILITY_ALL);
  });

  it('ignores unknown and repeated slots', () => {
    expect(availabilityMask(['mon-night', 'mon-night', 'nope'])).toBe(
      availabilityMask(['mon-night']),
    );
  });

  it('builds a filter from a day, a part of the day or both', () => {
    expect(availabilityFilterMask('', '')).toBeNull();
    expect(availabilitySlots(availabilityFilterMask('sat', '')!)).toEqual([
      'sat-morning',
      'sat-afternoon',
      'sat-night',
    ]);
    expect(availabilitySlots(availabilityFilterMask('', 'night')!)).toHaveLength(7);
    expect(availabilitySlots(availabilityFilterMask('fri', 'night')!)).toEqual(['fri-night']);
  });

  it('groups the days by part of the day', () => {
    expect(
      availabilityByPeriod(availabilityMask(['wed-night', 'mon-night', 'sat-afternoon'])),
    ).toEqual([
      { period: 'afternoon', days: ['sat'] },
      { period: 'night', days: ['mon', 'wed'] },
    ]);
    expect(availabilityByPeriod(0)).toEqual([]);
  });

  it('takes known slots only', () => {
    expect(availabilitySchema.safeParse({ slots: ['mon-night'] }).success).toBe(true);
    expect(availabilitySchema.safeParse({ slots: ['mon-dawn'] }).success).toBe(false);
  });
});
