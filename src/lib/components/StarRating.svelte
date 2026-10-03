<script lang="ts">
  // Five stars to score something, on Skeleton's Rating Group: arrows move the score, a click sets
  // it, and the form gets the number under `name`. Whole stars only.
  import { RatingGroup } from '@skeletonlabs/skeleton-svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    name,
    label,
    value = 0,
    count = 5,
    invalid = false,
    describedby,
    onchange,
  }: {
    name: string;
    label: string;
    value?: number;
    count?: number;
    invalid?: boolean;
    describedby?: string;
    onchange?: (value: number) => void;
  } = $props();

  // What was given, until a star is chosen.
  let current = $derived(value);
</script>

<RatingGroup
  {count}
  {name}
  value={current}
  allowHalf={false}
  translations={{ ratingValueText: (index) => m.rating_score_label({ score: index }) }}
  onValueChange={(details) => {
    current = details.value;
    onchange?.(details.value);
  }}
>
  <RatingGroup.Label class="font-semibold">{label}</RatingGroup.Label>
  <RatingGroup.Control
    class="mt-2 flex gap-1 text-primary-500"
    aria-invalid={invalid || undefined}
    aria-describedby={describedby}
  >
    <RatingGroup.Context>
      {#snippet children(rating)}
        {#each rating().items as index (index)}
          <RatingGroup.Item
            {index}
            class="flex size-11 items-center justify-center rounded-lg hover:preset-tonal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          />
        {/each}
      {/snippet}
    </RatingGroup.Context>
  </RatingGroup.Control>
  <RatingGroup.HiddenInput />
</RatingGroup>
