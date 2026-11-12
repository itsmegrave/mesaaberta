<script lang="ts">
  // One play-style axis in the card setup: Skeleton's Slider between the two poles' naipes. The
  // value is 0 to 100 towards the first pole, so the slider runs right to left.
  import { Slider } from '@skeletonlabs/skeleton-svelte';
  import { MATCH_AXES, leaning, type MatchAxis } from '@mesaaberta/core/matches/schema';
  import { m } from '#lib/paraglide/messages.js';
  import { axisQuestion, poleName } from '../suits';
  import SuitIcon from './SuitIcon.svelte';

  let { axis, value = $bindable(50) }: { axis: MatchAxis; value: number } = $props();

  const [first, second] = $derived(MATCH_AXES.find((a) => a.key === axis)!.poles);
  const lean = $derived(leaning(axis, value));
  const id = $derived(`match-axis-${axis}`);
</script>

<!-- The slider runs reversed, so it posts its own value: the form's field carries the real one. -->
<input type="hidden" name={axis} {value} />
<Slider
  ids={{ thumb: () => id }}
  value={[100 - value]}
  min={0}
  max={100}
  step={5}
  onValueChange={(details) => (value = 100 - details.value[0])}
  class="grid gap-1"
>
  <Slider.Label class="text-sm font-semibold text-muted">{axisQuestion(axis)}</Slider.Label>
  <div class="flex items-center gap-2">
    {@render end(first)}
    <Slider.Control class="flex h-11 min-w-0 flex-1 items-center">
      <Slider.Track class="h-2.5 grow rounded-full border-2 border-punk-ink bg-punk-yellow">
        <Slider.Range class="h-full" />
      </Slider.Track>
      <Slider.Thumb
        index={0}
        class="size-7 rounded-full border-3 border-punk-ink bg-punk-pink shadow-[2px_2px_0_var(--color-punk-ink)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        aria-valuetext={m.match_axis_value({ pole: poleName(lean.pole), percent: lean.percent })}
      ></Slider.Thumb>
    </Slider.Control>
    {@render end(second)}
  </div>
</Slider>

{#snippet end(pole: (typeof MATCH_AXES)[number]['poles'][number])}
  <span
    class="flex w-20 shrink-0 flex-col items-center gap-0.5 text-xs whitespace-nowrap {lean.pole ===
    pole
      ? 'font-bold'
      : 'text-muted'}"
  >
    <SuitIcon {pole} size={26} />{poleName(pole)}
  </span>
{/snippet}
