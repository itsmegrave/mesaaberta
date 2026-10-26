<script lang="ts">
  // A month of days inside a Skeleton Date Picker: the month's name between the previous and next
  // buttons, then the grid of days. It goes in a DatePicker's content, popup or inline.
  import { DatePicker } from '@skeletonlabs/skeleton-svelte';
  import { m } from '#lib/paraglide/messages.js';

  const navButton = 'btn size-11 rounded-lg hover:preset-tonal';
</script>

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
        <DatePicker.RangeText class="block font-semibold first-letter:uppercase" />
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
