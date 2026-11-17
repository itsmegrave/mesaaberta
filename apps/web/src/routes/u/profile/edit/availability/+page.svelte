<script lang="ts">
  // "Quando posso jogar": a week of checkboxes, a row per day and a column per part of the day.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { dayLong, periodLabel } from '#lib/profile/availability.js';
  import { toast } from '#lib/toaster.js';
  import {
    AVAILABILITY_DAYS,
    AVAILABILITY_PERIODS,
    availabilitySchema,
    type AvailabilityInput,
    type AvailabilitySlot,
  } from '@mesaaberta/core/profile/availability';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm<AvailabilityInput>({
    ...fromResult(result?.form ?? data.form),
    schema: availabilitySchema,
    refresh: false,
    domain: 'account',
    onSuccess: () => {
      controller.markSaved();
      toast.success(m.availability_saved());
    },
    errorMessage: m.availability_failed,
  });
  guardDraft(controller);

  const picked = $derived(controller.values.slots);
  const toggle = (slot: AvailabilitySlot, on: boolean) =>
    controller.change('slots', on ? [...picked, slot] : picked.filter((pick) => pick !== slot));
</script>

<SettingsSection title={m.profile_section_availability()} lede={m.availability_lede()} />

<section
  aria-label={m.profile_section_availability()}
  class="rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8"
>
  <MAForm action="?/save" onsubmit={controller.submit} class="grid max-w-xl gap-6">
    <FormBanner text={controller.errors._errors?.[0]} />
    <table class="w-full border-collapse text-left">
      <caption class="sr-only">{m.profile_section_availability()}</caption>
      <thead>
        <tr class="border-b border-surface-200-800">
          <td></td>
          {#each AVAILABILITY_PERIODS as period (period)}
            <th scope="col" class="pb-2 text-center text-sm font-semibold">{periodLabel(period)}</th
            >
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each AVAILABILITY_DAYS as day (day)}
          <tr class="border-b border-surface-200-800 last:border-b-0">
            <th scope="row" class="py-1 pr-3 font-semibold">{dayLong(day)}</th>
            {#each AVAILABILITY_PERIODS as period (period)}
              {@const slot = `${day}-${period}` as AvailabilitySlot}
              <td class="text-center">
                <!-- The whole cell is the 44px target. -->
                <label class="inline-flex size-11 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    class="checkbox"
                    name="slots"
                    value={slot}
                    checked={picked.includes(slot)}
                    aria-label={m.availability_slot({
                      day: dayLong(day),
                      period: periodLabel(period),
                    })}
                    onchange={(event) => toggle(slot, event.currentTarget.checked)}
                  />
                </label>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="text-sm text-muted">{m.availability_hint()}</p>
    <div>
      <MAButton
        type="submit"
        size="custom"
        {controller}
        class="btn h-11 w-full gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold sm:w-auto"
      >
        {m.availability_save()}
      </MAButton>
    </div>
  </MAForm>
</section>
