<script lang="ts">
  // A day picked on Skeleton's Date Picker and, with `withTime`, the hour typed next to it. The form
  // gets one value as the native fields would send it: `YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` without
  // the hour. Until JavaScript runs it is the native field, so the form works without it.
  import { DatePicker, Portal } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { DEFAULT_TIME, pickerTranslations, safeParse } from '#lib/forms/date.js';
  import CalendarDays from './CalendarDays.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';

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

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const day = $derived(/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '');
  const time = $derived(value.slice(11, 16));
  const set = (nextDay: string, nextTime: string) =>
    (value = withTime ? (nextDay ? `${nextDay}T${nextTime}` : '') : nextDay);

  const picked = $derived(safeParse(day));
  const earliest = $derived(min ? safeParse(min) : undefined);

  const control =
    'flex h-13 w-full items-center rounded-lg border-control border-ink-muted bg-panel focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-primary-500';
</script>

{#if mounted}
  <div class="grid gap-1">
    <DatePicker
      locale="pt-BR"
      value={picked ? [picked] : []}
      min={earliest}
      ids={{ input: () => id }}
      positioning={{ placement: 'bottom-start' }}
      translations={pickerTranslations((open) =>
        open ? m.date_picker_close() : m.date_picker_open({ label }),
      )}
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
            class="input h-13 w-32 shrink-0 rounded-lg border-control border-ink-muted bg-panel px-3"
          />
        {/if}
      </div>
      <Portal>
        <DatePicker.Positioner class="z-50!">
          <DatePicker.Content
            class="w-80 card border border-surface-200-800 bg-surface-100-900 p-3 shadow-2xl"
          >
            <CalendarDays />
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
    <TextInput
      {id}
      {name}
      type={withTime ? 'datetime-local' : 'date'}
      {required}
      min={min ? (withTime ? `${min}T00:00` : min) : undefined}
      bind:value
      class="input h-13 rounded-lg border-control border-ink-muted bg-panel px-3"
      aria-invalid={invalid || undefined}
      aria-describedby={describedby}
    />
  </div>
{/if}
