<script lang="ts">
  // A day picked on Skeleton's Date Picker and, with `withTime`, the hour typed next to it. The form
  // gets one value as the native fields would send it: `YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` without
  // the hour. Until JavaScript runs it is the native field, so the form works without it.
  import { DatePicker, Portal, parseDate } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    id,
    name,
    label,
    hint,
    value = $bindable(''),
    withTime = false,
    min,
    required = false,
    invalid = false,
    describedby,
  }: {
    id: string;
    name: string;
    label: string;
    hint?: string;
    value: string;
    withTime?: boolean;
    /** The first day that can be picked, `YYYY-MM-DD`. */
    min?: string;
    required?: boolean;
    invalid?: boolean;
    /** The ids of the hint and the error, when there are. */
    describedby?: string;
  } = $props();

  // The hour offered once a day is picked, until one is typed: an evening, when most tables play.
  const DEFAULT_TIME = '19:00';

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const day = $derived(/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');
  const time = $derived(value.slice(11, 16));
  const set = (nextDay: string, nextTime: string) =>
    (value = withTime ? (nextDay ? `${nextDay}T${nextTime}` : '') : nextDay);

  const safeParse = (text: string) => {
    try {
      return text ? parseDate(text) : undefined;
    } catch {
      return undefined;
    }
  };
  const picked = $derived(safeParse(day));
  const earliest = $derived(min ? safeParse(min) : undefined);

  const control =
    'flex h-12 w-full items-center rounded-lg border-2 border-surface-200-800 bg-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500';
  const navButton = 'btn size-11 rounded-lg hover:preset-tonal';
</script>

{#if mounted}
  <div class="grid gap-1">
    <DatePicker
      locale="pt-BR"
      value={picked ? [picked] : []}
      min={earliest}
      ids={{ input: () => id }}
      positioning={{ placement: 'bottom-start' }}
      translations={{
        // Its own words (buttons and days) default to English.
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
        trigger: (open) => (open ? m.date_picker_close() : m.date_picker_open({ label })),
        content: m.date_picker_calendar(),
        placeholder: () => ({ day: 'dd', month: 'mm', year: 'aaaa' }),
      }}
      onValueChange={(details) =>
        // ISO (`2026-10-10`), not `valueAsString`, which is the date as the locale writes it.
        set(details.value[0]?.toString() ?? '', time || DEFAULT_TIME)}
    >
      <DatePicker.Label class="label-text font-semibold">{label}</DatePicker.Label>
      {#if hint}<p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>{/if}
      <div class="flex gap-2">
        <DatePicker.Control class="{control} min-w-0 grow">
          <DatePicker.Input
            index={0}
            placeholder="dd/mm/aaaa"
            class="h-full min-w-0 flex-1 bg-transparent px-3 outline-none"
            aria-invalid={invalid || undefined}
            aria-describedby={describedby}
            aria-required={required || undefined}
          />
          <DatePicker.Trigger
            class="flex h-full w-11 shrink-0 items-center justify-center text-muted"
            aria-label={m.date_picker_open({ label })}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              ><rect x="3" y="5" width="18" height="16" rx="2" /><path
                d="M3 10h18M8 3v4M16 3v4"
              /></svg
            >
          </DatePicker.Trigger>
        </DatePicker.Control>
        {#if withTime}
          <input
            type="time"
            value={time}
            disabled={!day}
            aria-label={m.date_picker_time({ label })}
            aria-invalid={invalid || undefined}
            onchange={(event) => set(day, event.currentTarget.value || time)}
            class="input h-12 w-32 shrink-0 rounded-lg border-surface-200-800 bg-panel px-3"
          />
        {/if}
      </div>
      <Portal>
        <DatePicker.Positioner class="z-50!">
          <DatePicker.Content
            class="w-80 card border border-surface-200-800 bg-surface-100-900 p-3 shadow-2xl"
          >
            <DatePicker.View view="day">
              <DatePicker.Context>
                {#snippet children(picker)}
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
                        {#each picker().weekDays as weekDay (weekDay.long)}
                          <DatePicker.TableHeader class="pb-1 text-xs font-semibold text-muted"
                            >{weekDay.narrow}</DatePicker.TableHeader
                          >
                        {/each}
                      </DatePicker.TableRow>
                    </DatePicker.TableHead>
                    <DatePicker.TableBody>
                      {#each picker().weeks as week, row (row)}
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
        </DatePicker.Positioner>
      </Portal>
    </DatePicker>
    <input type="hidden" {name} {value} />
  </div>
{:else}
  <div class="grid gap-1">
    <label for={id} class="label-text font-semibold">{label}</label>
    {#if hint}<p id="{id}-hint" class="text-sm text-surface-700-300">{hint}</p>{/if}
    <input
      {id}
      {name}
      type={withTime ? 'datetime-local' : 'date'}
      {required}
      min={min ? (withTime ? `${min}T00:00` : min) : undefined}
      bind:value
      class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
      aria-invalid={invalid || undefined}
      aria-describedby={describedby}
    />
  </div>
{/if}
