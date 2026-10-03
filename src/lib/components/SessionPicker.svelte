<script lang="ts">
  // When a table plays: the day on an inline calendar, the hour and the minute (every 15) on two
  // selects, the length as 2 h / 3 h / 4 h / Outra, and one sentence saying it back, with the zone.
  // The form gets `startsAtLocal` as `YYYY-MM-DDTHH:mm` and `durationHours` as a number.
  import { DatePicker, parseDate } from '@skeletonlabs/skeleton-svelte';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { TABLE_LIMITS } from '$lib/tables/schema';

  let {
    startsAt = $bindable(''),
    duration = $bindable(4),
    timezone,
    min,
    invalid = false,
    describedby,
  }: {
    startsAt: string;
    /** Hours. */
    duration: number;
    timezone: string;
    /** The first day that can be picked, `YYYY-MM-DD`. */
    min?: string;
    invalid?: boolean;
    describedby?: string;
  } = $props();

  const DEFAULT_TIME = '19:00';
  const PRESETS = [2, 3, 4];
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const day = $derived(/^\d{4}-\d{2}-\d{2}/.test(startsAt) ? startsAt.slice(0, 10) : '');
  const hour = $derived(startsAt.slice(11, 13) || DEFAULT_TIME.slice(0, 2));
  const minute = $derived(startsAt.slice(14, 16) || DEFAULT_TIME.slice(3));
  const set = (nextDay: string, nextHour: string, nextMinute: string) =>
    (startsAt = nextDay ? `${nextDay}T${nextHour}:${nextMinute}` : '');

  const safeParse = (text: string) => {
    try {
      return text ? parseDate(text) : undefined;
    } catch {
      return undefined;
    }
  };
  const picked = $derived(safeParse(day));
  const earliest = $derived(min ? safeParse(min) : undefined);

  const length = $derived(Number(duration) || 0);
  let custom = $state(false);
  // A length that is not one of the segments opens "Outra".
  const other = $derived(custom || (!!length && !PRESETS.includes(length)));

  const summary = $derived.by(() => {
    if (!day) return m.session_summary_empty();
    const date = new Intl.DateTimeFormat(getLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${day}T12:00:00Z`));
    return m.session_summary({
      date,
      time: `${hour}:${minute}`,
      hours: String(length || ''),
      zone: timezone.replaceAll('_', ' '),
    });
  });

  const segment =
    'btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500';
  const selectClass = 'select h-12 rounded-lg border-surface-200-800 bg-panel px-3';
  const navButton = 'btn size-11 rounded-lg hover:preset-tonal';
</script>

<div class="grid gap-5">
  <div class="grid gap-1">
    <DatePicker
      inline
      locale="pt-BR"
      value={picked ? [picked] : []}
      min={earliest}
      translations={{
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
        trigger: () => m.session_day(),
        content: m.date_picker_calendar(),
        placeholder: () => ({ day: 'dd', month: 'mm', year: 'aaaa' }),
      }}
      onValueChange={(details) => set(details.value[0]?.toString() ?? '', hour, minute)}
    >
      <DatePicker.Label class="label-text font-semibold">{m.session_day()}</DatePicker.Label>
      <DatePicker.Content
        class="w-full max-w-sm rounded-lg border-2 p-3 {invalid
          ? 'border-error-500'
          : 'border-surface-200-800'} bg-panel"
        aria-describedby={describedby}
      >
        <DatePicker.View view="day">
          <DatePicker.Context>
            {#snippet children(calendar)}
              <DatePicker.ViewControl class="mb-2 flex items-center justify-between gap-2">
                <DatePicker.PrevTrigger class={navButton} aria-label={m.date_picker_prev()}
                  ><svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg
                  ></DatePicker.PrevTrigger
                >
                <DatePicker.RangeText class="font-semibold capitalize" />
                <DatePicker.NextTrigger class={navButton} aria-label={m.date_picker_next()}
                  ><svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
                  ></DatePicker.NextTrigger
                >
              </DatePicker.ViewControl>
              <DatePicker.Table class="w-full text-center text-sm">
                <DatePicker.TableHead>
                  <DatePicker.TableRow>
                    {#each calendar().weekDays as weekDay (weekDay.long)}
                      <DatePicker.TableHeader class="pb-1 text-xs font-semibold text-muted"
                        >{weekDay.narrow}</DatePicker.TableHeader
                      >
                    {/each}
                  </DatePicker.TableRow>
                </DatePicker.TableHead>
                <DatePicker.TableBody>
                  {#each calendar().weeks as week, row (row)}
                    <DatePicker.TableRow>
                      {#each week as date (date.toString())}
                        <DatePicker.TableCell value={date}>
                          <DatePicker.TableCellTrigger
                            class="mx-auto flex size-11 items-center justify-center rounded-lg hover:preset-tonal data-disabled:opacity-40 data-outside-range:opacity-40 data-selected:preset-filled-primary-500 data-today:font-bold"
                            >{date.day}</DatePicker.TableCellTrigger
                          >
                        </DatePicker.TableCell>
                      {/each}
                    </DatePicker.TableRow>
                  {/each}
                </DatePicker.TableBody>
              </DatePicker.Table>
            {/snippet}
          </DatePicker.Context>
        </DatePicker.View>
      </DatePicker.Content>
    </DatePicker>
  </div>

  <div class="flex flex-wrap gap-4">
    <div class="grid gap-1">
      <span class="label-text font-semibold" aria-hidden="true">{m.session_hour()}</span>
      <select
        class={selectClass}
        aria-label={m.session_hour()}
        value={hour}
        disabled={!day}
        onchange={(event) => set(day, event.currentTarget.value, minute)}
      >
        {#each hours as option (option)}<option value={option}>{option}</option>{/each}
      </select>
    </div>
    <div class="grid gap-1">
      <span class="label-text font-semibold" aria-hidden="true">{m.session_minute()}</span>
      <select
        class={selectClass}
        aria-label={m.session_minute()}
        value={minute}
        disabled={!day}
        onchange={(event) => set(day, hour, event.currentTarget.value)}
      >
        {#each minutes as option (option)}<option value={option}>{option}</option>{/each}
      </select>
    </div>
  </div>

  <fieldset class="grid gap-2">
    <legend class="label-text font-semibold">{m.session_duration()}</legend>
    <div class="flex flex-wrap gap-2">
      {#each PRESETS as preset (preset)}
        <label class={segment}>
          <input
            type="radio"
            name="durationPreset"
            class="sr-only"
            checked={!other && length === preset}
            onchange={() => {
              custom = false;
              duration = preset;
            }}
          />{m.session_duration_hours({ hours: preset })}
        </label>
      {/each}
      <label class={segment}>
        <input
          type="radio"
          name="durationPreset"
          class="sr-only"
          checked={other}
          onchange={() => (custom = true)}
        />{m.session_duration_other()}
      </label>
    </div>
    {#if other}
      <label class="grid gap-1">
        <span class="label-text">{m.session_duration_custom()}</span>
        <input
          type="number"
          inputmode="decimal"
          min={TABLE_LIMITS.durationHours.min}
          max={TABLE_LIMITS.durationHours.max}
          step={TABLE_LIMITS.durationHours.step}
          bind:value={duration}
          class="input h-12 max-w-32 rounded-lg border-surface-200-800 bg-panel px-3"
        />
      </label>
    {/if}
  </fieldset>

  <p role="status" class="text-sm font-semibold">{summary}</p>
  <input type="hidden" name="startsAtLocal" value={startsAt} />
  <input type="hidden" name="durationHours" value={duration} />
</div>
