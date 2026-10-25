import { parseDate, type DatePickerRootProps } from '@skeletonlabs/skeleton-svelte';
import { m } from '#lib/paraglide/messages.js';

// What DateTimeField and SessionPicker share around Skeleton's Date Picker.

/** The hour offered once a day is picked, until one is typed: an evening, when most tables play. */
export const DEFAULT_TIME = '19:00';

/** A `YYYY-MM-DD` as the picker's date, or undefined for an empty or impossible one. */
export function safeParse(text: string | undefined) {
  try {
    return text ? parseDate(text) : undefined;
  } catch {
    return undefined;
  }
}

/** The picker's own words (buttons and days), which default to English; `trigger` names its opener. */
export function pickerTranslations(
  trigger: (open: boolean) => string,
): NonNullable<DatePickerRootProps['translations']> {
  return {
    dayCell: (state) =>
      state.unavailable || state.disabled
        ? m.date_picker_day_unavailable({ date: state.valueText })
        : m.date_picker_day({ date: state.valueText }),
    nextTrigger: () => m.date_picker_next(),
    prevTrigger: () => m.date_picker_prev(),
    viewTrigger: () => m.date_picker_view(),
    presetTrigger: () => '',
    monthSelect: m.date_picker_month(),
    yearSelect: m.date_picker_year(),
    clearTrigger: m.date_picker_clear(),
    trigger,
    content: m.date_picker_calendar(),
    placeholder: () => ({ day: 'dd', month: 'mm', year: 'aaaa' }),
  };
}
