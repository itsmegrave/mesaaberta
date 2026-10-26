<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  // "Privacidade e dados": what everyone else sees of the profile, a download of everything the
  // account keeps, and closing the account (typing the @usuário to confirm).
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import SettingsSection from '../components/ui/SettingsSection.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { deleteAccountSchema } from '#lib/profile/delete.js';
  import { queryClient } from '#lib/query/context.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();
  const client = queryClient();

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const heading = 'text-2xl leading-tight font-semibold tracking-tight';

  // svelte-ignore state_referenced_locally
  const closing = actionForm({
    initial:
      result?.form && 'confirm' in result.form.data ? result.form.data : data.deleteForm.data,
    schema: deleteAccountSchema,
    initialErrors: result?.form && 'confirm' in result.form.data ? result.form.errors : {},
    onSuccess: () => client.clear(),
    errorMessage: m.auth_error_failed,
  });
  const { draft: closingData } = closing;

  // The typed @usuário is checked here first (the server checks it again), then a dialog asks once
  // more before the form goes. Only "Apagar minha conta" in the dialog sends it.
  let closingForm = $state<HTMLFormElement>();
  let asking = $state(false);
  let mismatch = $state(false);
  let confirmed = false;
  const typed = () =>
    String($closingData.confirm ?? '')
      .trim()
      .toLowerCase();
  function ask(event: SubmitEvent) {
    if (confirmed) {
      confirmed = false;
      return closing.submit(event);
    }
    event.preventDefault();
    if (closing.pending) return;
    mismatch = typed() !== (data.username ?? '').toLowerCase();
    if (mismatch) closingForm?.querySelector<HTMLElement>('#confirm')?.focus();
    else asking = true;
  }
  function proceed() {
    asking = false;
    confirmed = true;
    closingForm?.requestSubmit();
  }
  // Focus starts on "Cancelar": the safe answer.
  const cancelFirst = () => document.querySelector<HTMLElement>('[data-confirm-cancel]');

  const check = 'M5 12.5l4.5 4.5L19 7.5';
  const cross = 'M6 6l12 12M18 6L6 18';
</script>

{#snippet mark(path: string)}
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
    class="mt-1 shrink-0"><path d={path} /></svg
  >
{/snippet}

<SettingsSection title={m.profile_section_data()} lede={m.profile_section_data_lede()} />

<section aria-labelledby="seen" class={card}>
  <h3 id="seen" class={heading}>{m.account_seen_title()}</h3>
  <ul class="mt-4 grid gap-3">
    <li class="flex gap-3">{@render mark(check)}{m.account_seen_username()}</li>
    <li class="flex gap-3">{@render mark(check)}{m.account_seen_rating()}</li>
    <li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_email()}</li>
    <li class="flex gap-3 text-muted">{@render mark(cross)}{m.account_seen_comments()}</li>
  </ul>
</section>

<section aria-labelledby="your-data" class={card}>
  <h3 id="your-data" class={heading}>{m.account_data_title()}</h3>
  <p class="mt-3 max-w-prose">
    {m.account_data_text()}
    <a href="/privacy" class="link-underline text-surface-950-50">{m.privacy_title()}</a>.
  </p>
  <a
    href="/u/profile/export"
    download
    data-sveltekit-reload
    class="mt-5 btn h-12 gap-2 rounded-lg border-2 border-primary-500 px-6 font-semibold"
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
      class="shrink-0"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg
    >
    {m.account_export()}
  </a>
</section>

<!-- What cannot be undone gets a card of its own, last on the page (DS DangerZone). -->
<section
  aria-labelledby="danger-zone"
  class="rounded-lg border-2 border-error-500 bg-panel p-6 md:p-8"
>
  <h3 id="danger-zone" class="flex items-center gap-2 {heading} text-error-alert">
    <Icon name="triangle-alert" size={24} />{m.account_danger_zone()}
  </h3>
  <div class="mt-5">
    <h4 class="text-lg font-semibold">{m.account_delete_title()}</h4>
    <p class="mt-2 max-w-prose text-muted">{m.account_delete_text()}</p>
    <MAForm
      action="?/delete"
      bind:element={closingForm}
      onsubmit={ask}
      class="mt-4 grid max-w-sm gap-3"
    >
      <label for="confirm" class="label-text font-semibold">{m.account_delete_confirm()}</label>
      <TextInput
        id="confirm"
        name="confirm"
        type="text"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        placeholder={data.username}
        bind:value={$closingData.confirm}
        oninput={() => (mismatch = false)}
        aria-invalid={mismatch || closing.errors.confirm ? 'true' : undefined}
        aria-describedby={mismatch || closing.errors.confirm ? 'confirm-error' : undefined}
        class="input h-13 w-full rounded-lg border-control border-ink-muted bg-panel px-3"
      />
      <FieldError
        id="confirm"
        class=""
        message={mismatch || closing.errors.confirm ? m.account_delete_error() : undefined}
      />
      <div>
        <MAButton type="submit" controller={closing} variant="danger" class="px-6 font-semibold">
          {m.account_delete_button()}
        </MAButton>
      </div>
    </MAForm>
  </div>
</section>

<DialogShell
  bind:open={asking}
  role="alertdialog"
  sheet
  initialFocusEl={cancelFirst}
  title={m.account_delete_dialog_title()}
  description={m.account_delete_dialog_text()}
>
  <DialogActions
    class="mt-6"
    cancel={m.confirm_cancel()}
    cancelAttributes={{ 'data-confirm-cancel': '' }}
    tone="danger"
    confirm={m.account_delete_button()}
    onconfirm={proceed}
  />
</DialogShell>
