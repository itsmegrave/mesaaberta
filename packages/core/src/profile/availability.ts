import { z } from 'zod';

z.config({ jitless: true });

// "Quando posso jogar": the days and parts of the day a person can usually play, shown on their
// profile and on Procuro mesa, where GMs filter by it. Stored as one integer, a bit per slot
// (`profiles.availability`), so a filter is one bitwise test.

/** Monday first, as Brazilian forms and calendars list the week. */
export const AVAILABILITY_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/** Manhã (until noon), tarde (until 6 pm) and noite. */
export const AVAILABILITY_PERIODS = ['morning', 'afternoon', 'night'] as const;
export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];
export type AvailabilityPeriod = (typeof AVAILABILITY_PERIODS)[number];
export type AvailabilitySlot = `${AvailabilityDay}-${AvailabilityPeriod}`;

export const AVAILABILITY_SLOTS = AVAILABILITY_DAYS.flatMap((day) =>
  AVAILABILITY_PERIODS.map((period) => `${day}-${period}` as AvailabilitySlot),
);
/** Every slot on: the largest value `profiles.availability` holds (its check mirrors it). */
export const AVAILABILITY_ALL = 2 ** AVAILABILITY_SLOTS.length - 1;

const bit = (slot: AvailabilitySlot) => 2 ** AVAILABILITY_SLOTS.indexOf(slot);

/** The stored integer of a set of slots; an unknown slot counts for nothing. */
export function availabilityMask(slots: readonly string[]): number {
  let mask = 0;
  for (const slot of new Set(slots))
    if ((AVAILABILITY_SLOTS as readonly string[]).includes(slot))
      mask += bit(slot as AvailabilitySlot);
  return mask;
}

/** The slots a stored integer holds, in week order. */
export function availabilitySlots(mask: number): AvailabilitySlot[] {
  return AVAILABILITY_SLOTS.filter((slot) => Math.floor(mask / bit(slot)) % 2 === 1);
}

/**
 * The slots a filter matches: a day, a part of the day or both. Neither: null (no filter). A
 * person matches when they share at least one slot with it.
 */
export function availabilityFilterMask(day: string, period: string): number | null {
  if (!day && !period) return null;
  return availabilityMask(
    AVAILABILITY_SLOTS.filter((slot) => {
      const [d, p] = slot.split('-');
      return (!day || d === day) && (!period || p === period);
    }),
  );
}

/** The days by part of the day, for "Noite: seg, qua, sex". Parts with no day are left out. */
export function availabilityByPeriod(mask: number) {
  const slots = availabilitySlots(mask);
  return AVAILABILITY_PERIODS.map((period) => ({
    period,
    days: AVAILABILITY_DAYS.filter((day) => slots.includes(`${day}-${period}`)),
  })).filter((row) => row.days.length > 0);
}

/** The "Quando posso jogar" form: the slots ticked (none clears it). */
export const availabilitySchema = z.object({
  slots: z.array(z.enum(AVAILABILITY_SLOTS as [AvailabilitySlot, ...AvailabilitySlot[]])),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
