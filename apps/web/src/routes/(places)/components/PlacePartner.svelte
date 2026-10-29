<script lang="ts">
  // "Parceiro" under the place's edit form: show the place as one of the partners the person looks
  // after ("Parceiro Mesa Aberta"). A request waits for an admin; the link that is up, or the request
  // that waits, can be taken back. Every action asks the server, which authorizes it again.
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { toast } from '#lib/toaster.js';
  import {
    placePartnerEndSchema,
    placePartnerRequestSchema,
  } from '@mesaaberta/core/places/partner-links';

  type Link = { id: string; partnerId: string; name: string };
  let {
    approved,
    pending,
    options,
  }: {
    /** The partner the place shows now. */
    approved: Link | null;
    /** The request that waits for an admin. */
    pending: (Link & { createdAt: Date | string }) | null;
    /** The partners the person looks after that are on their page. */
    options: { id: string; name: string }[];
  } = $props();

  const date = (value: Date | string) =>
    new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short' }).format(new Date(value));
  // The partner it has now is not offered again.
  const items = $derived(
    options
      .filter((option) => option.id !== approved?.partnerId)
      .map((option) => ({ slug: option.id, name: option.name })),
  );

  const form = actionForm<{ partnerId: string }>({
    initial: { partnerId: '' },
    schema: placePartnerRequestSchema,
    errorMessage: m.place_partner_err_generic,
    onSuccess: () => {
      toast.success(m.place_partner_requested());
      form.reset({ partnerId: '' });
      picked = [];
    },
  });
  const { draft } = form;
  let picked = $state<string[]>([]);
  const requestError = $derived.by(() => {
    const code = form.errors.partnerId?.[0] ?? form.errors._errors?.[0] ?? form.message?.code;
    if (!code) return undefined;
    if (code === 'required' || code === 'invalid_format') return m.place_partner_err_required();
    if (code === 'already_linked') return m.place_partner_err_already();
    return m.place_partner_err_generic();
  });
</script>

<FormSection
  id="partner-section"
  icon="game-icons:shaking-hands"
  title={m.place_partner_title()}
  hint={m.place_partner_hint()}
>
  {#if approved}
    <div
      class="flex flex-col gap-3 rounded-lg border border-surface-200-800 p-4 sm:flex-row sm:items-center"
    >
      <p class="min-w-0 flex-1 font-semibold">
        <a href="/p/{approved.partnerId}" class="underline underline-offset-4"
          >{m.place_partner_badge({ name: approved.name })}</a
        >
      </p>
      <PostButton
        action="?/removePartner"
        schema={placePartnerEndSchema}
        errorMessage={m.place_partner_err_generic}
        success={m.place_partner_removed()}
        onFailure={() => toast.error(m.place_partner_err_generic())}
        variant="secondary"
        size="sm"
        buttonClass="shrink-0 font-semibold">{m.place_partner_remove()}</PostButton
      >
    </div>
  {/if}

  {#if pending}
    <div
      class="flex flex-col gap-3 rounded-lg border border-dashed border-surface-200-800 p-4 sm:flex-row sm:items-center"
    >
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-2">
          <span class="font-semibold">{pending.name}</span>
          <Pill tone="warning">{m.place_partner_pending()}</Pill>
        </p>
        <p class="text-sm text-muted">{m.place_partner_asked({ date: date(pending.createdAt) })}</p>
      </div>
      <PostButton
        action="?/cancelPartner"
        schema={placePartnerEndSchema}
        errorMessage={m.place_partner_err_generic}
        success={m.place_partner_cancelled()}
        onFailure={() => toast.error(m.place_partner_err_generic())}
        variant="secondary"
        size="sm"
        buttonClass="shrink-0 font-semibold">{m.place_partner_cancel()}</PostButton
      >
    </div>
  {:else if items.length > 0}
    <MAForm
      action="?/requestPartner"
      onsubmit={form.submit}
      class="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div class="min-w-0 flex-1">
        <SearchSelect
          id="partner-pick"
          name="partnerId"
          label={m.place_partner_label()}
          labelClass="label-text block font-semibold"
          class="flex flex-col gap-1"
          items={[...items]}
          bind:value={picked}
          invalid={!!requestError}
          placeholder={m.place_partner_placeholder()}
          onchange={(next) => ($draft.partnerId = next[0] ?? '')}
        />
        <FieldError id="partner-pick" message={requestError} />
      </div>
      <MAButton type="submit" variant="secondary" controller={form} class="font-semibold"
        >{m.place_partner_submit()}</MAButton
      >
    </MAForm>
  {:else if !approved}
    <p class="text-sm text-muted">
      {m.place_partner_none()}
      <a href="/partners/new" class="font-semibold text-link underline underline-offset-4"
        >{m.place_partner_none_link()}</a
      >
    </p>
  {/if}
</FormSection>
