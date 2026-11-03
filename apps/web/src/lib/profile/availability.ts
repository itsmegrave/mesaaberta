import { m } from '#lib/paraglide/messages.js';
import {
  AVAILABILITY_DAYS,
  availabilityByPeriod,
  type AvailabilityDay,
  type AvailabilityPeriod,
} from '@mesaaberta/core/profile/availability';

/** "seg", "ter"… for a day of "Quando posso jogar". */
export const dayShort = (day: AvailabilityDay) =>
  ({
    mon: m.availability_day_mon,
    tue: m.availability_day_tue,
    wed: m.availability_day_wed,
    thu: m.availability_day_thu,
    fri: m.availability_day_fri,
    sat: m.availability_day_sat,
    sun: m.availability_day_sun,
  })[day]();

/** "Segunda", "Terça"… for the Procuro mesa filter. */
export const dayLong = (day: AvailabilityDay) =>
  ({
    mon: m.availability_day_mon_long,
    tue: m.availability_day_tue_long,
    wed: m.availability_day_wed_long,
    thu: m.availability_day_thu_long,
    fri: m.availability_day_fri_long,
    sat: m.availability_day_sat_long,
    sun: m.availability_day_sun_long,
  })[day]();

/** "Manhã", "Tarde", "Noite". */
export const periodLabel = (period: AvailabilityPeriod) =>
  ({
    morning: m.availability_period_morning,
    afternoon: m.availability_period_afternoon,
    night: m.availability_period_night,
  })[period]();

/** "Noite: seg, qua, sex", one line per part of the day with a day in it. None: an empty list. */
export function availabilityLines(mask: number): string[] {
  return availabilityByPeriod(mask).map(({ period, days }) =>
    m.availability_line({
      period: periodLabel(period),
      days:
        days.length === AVAILABILITY_DAYS.length
          ? m.availability_every_day()
          : days.map(dayShort).join(', '),
    }),
  );
}
