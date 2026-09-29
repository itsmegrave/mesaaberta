<script lang="ts">
  // How many seats a table has: Skeleton's Slider, with the seats drawn under it as they will look
  // on the card. Until JavaScript runs it is a number field, so the form works without it.
  import { Slider } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import SeatDots from './SeatDots.svelte';

  let {
    id,
    name,
    label,
    value = $bindable(),
    min,
    max,
    invalid = false,
    describedby,
  }: {
    id: string;
    name: string;
    label: string;
    value: number;
    /** The fewest seats allowed: 1, or the seats already taken when editing. */
    min: number;
    max: number;
    invalid?: boolean;
    /** The ids of the hint and the error, when there are. */
    describedby?: string;
  } = $props();

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const seats = $derived(Math.min(max, Math.max(min, Math.round(Number(value) || min))));
</script>

{#if mounted}
  <Slider
    {name}
    ids={{ thumb: () => id }}
    value={[seats]}
    {min}
    {max}
    step={1}
    onValueChange={(details) => (value = details.value[0])}
    class="grid gap-3"
  >
    <div class="flex items-baseline justify-between gap-3">
      <Slider.Label class="label-text font-semibold">{label}</Slider.Label>
      <Slider.ValueText class="text-sm font-semibold"
        >{seats === 1
          ? m.form_capacity_seats_one()
          : m.form_capacity_seats({ count: seats })}</Slider.ValueText
      >
    </div>
    <Slider.Control class="flex h-11 items-center">
      <Slider.Track class="h-2 grow rounded-full bg-surface-200-800">
        <Slider.Range class="h-full rounded-full bg-primary-500" />
      </Slider.Track>
      <Slider.Thumb
        index={0}
        class="size-6 rounded-full border-2 border-primary-500 bg-surface-50-950 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        aria-invalid={invalid || undefined}
        aria-describedby={describedby}
      >
        <Slider.HiddenInput />
      </Slider.Thumb>
    </Slider.Control>
    <SeatDots taken={0} capacity={seats} />
  </Slider>
{:else}
  <div class="grid gap-1">
    <label for={id} class="label-text font-semibold">{label}</label>
    <input
      {id}
      {name}
      type="number"
      required
      {min}
      {max}
      bind:value
      class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
      aria-invalid={invalid || undefined}
      aria-describedby={describedby}
    />
  </div>
{/if}
