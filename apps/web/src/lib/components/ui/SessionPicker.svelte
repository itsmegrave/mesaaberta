<script lang="ts">
  // When a table plays: the day on an inline calendar, the hour and the minute (every 15) on two
  // selects, the length as 2 h / 3 h / 4 h / Outra, and one sentence saying it back, with the zone.
  // The form gets `startsAtLocal` as `YYYY-MM-DDTHH:mm` and `durationHours` as a number.
  import { DatePicker } from '@skeletonlabs/skeleton-svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { DEFAULT_TIME, pickerTranslations, safeParse } from '#lib/forms/date.js';
  import CalendarDays from './CalendarDays.svelte';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { TABLE_LIMITS } from '@mesaaberta/core/tables/schema';

  let {
    startsAt = $bindable(''),
    duration = $bindable(4),
    timezone,
    min,
    invalid = false,
    describedby,
    withDuration = true,
    name = 'startsAtLocal',
  }: {
    startsAt: string;
    /** Hours. */
    duration: number;
    timezone: string;
    /** The first day that can be picked, `YYYY-MM-DD`. */
    min?: string;
    invalid?: boolean;
    describedby?: string;
    /** False to pick only the day and hour (the next session of a table whose length is known). */
    withDuration?: boolean;
    /** The form field that carries `startsAt`. */
    name?: string;
  } = $props();

  const PRESETS = [2, 3, 4];
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const day = $derived(/^\d{4}-\d{2}-\d{2}/.test(startsAt) ? startsAt.slice(0, 10) : '');
  const hour = $derived(startsAt.slice(11, 13) || DEFAULT_TIME.slice(0, 2));
  const minute = $derived(startsAt.slice(14, 16) || DEFAULT_TIME.slice(3));
  const set = (nextDay: string, nextHour: string, nextMinute: string) =>
    (startsAt = nextDay ? `${nextDay}T${nextHour}:${nextMinute}` : '');

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
    'btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500';
</script>

<div class="grid gap-5">
  <div class="grid gap-1">
    <DatePicker
      inline
      locale="pt-BR"
      value={picked ? [picked] : []}
      min={earliest}
      translations={pickerTranslations(() => m.session_day())}
      onValueChange={(details) => set(details.value[0]?.toString() ?? '', hour, minute)}
    >
      <DatePicker.Label class="label-text font-semibold">{m.session_day()}</DatePicker.Label>
      <DatePicker.Content
        class="w-full max-w-sm rounded-lg border-2 p-3 {invalid
          ? 'border-error-500'
          : 'border-surface-200-800'} bg-panel"
        aria-describedby={describedby}
      >
        <CalendarDays />
      </DatePicker.Content>
    </DatePicker>
  </div>

  <div class="flex flex-wrap gap-4">
    {#each [{ id: 'session-hour', label: m.session_hour(), options: hours, current: hour, pick: (next: string) => set(day, next, minute) }, { id: 'session-minute', label: m.session_minute(), options: minutes, current: minute, pick: (next: string) => set(day, hour, next) }] as field (field.id)}
      <div class="w-32">
        <SearchSelect
          id={field.id}
          name={field.id}
          label={field.label}
          labelClass="label-text block font-semibold"
          class="grid gap-1"
          items={field.options.map((option) => ({ name: option, slug: option }))}
          value={[field.current]}
          placeholder={field.current}
          disabled={!day}
          onchange={(picked) => picked[0] && field.pick(picked[0])}
        />
      </div>
    {/each}
  </div>

  {#if withDuration}
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
          <TextInput
            type="number"
            inputmode="decimal"
            min={TABLE_LIMITS.durationHours.min}
            max={TABLE_LIMITS.durationHours.max}
            step={TABLE_LIMITS.durationHours.step}
            bind:value={duration}
            class="input h-13 max-w-32 rounded-lg border-control border-ink-muted bg-panel px-3"
          />
        </label>
      {/if}
    </fieldset>
  {/if}

  <p role="status" class="text-sm font-semibold">{summary}</p>
  <input type="hidden" {name} value={startsAt} />
  {#if withDuration}
    <input type="hidden" name="durationHours" value={duration} />
  {/if}
</div>
