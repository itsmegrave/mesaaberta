<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import CrowdfundingCard from '$lib/components/CrowdfundingCard.svelte';
  import DateTimeField from '$lib/components/DateTimeField.svelte';
  import ErrorSummary from '$lib/components/ErrorSummary.svelte';
  import Form from '$lib/components/Form.svelte';
  import FormBanner from '$lib/components/FormBanner.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { CROWDFUNDING_LIMITS, crowdfundingFormSchema } from '$lib/crowdfunding/schema';
  import { platformOf } from '$lib/crowdfunding/platforms';
  import { normalizeCampaignUrl } from '$lib/crowdfunding/url';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { guardDraft } from '$lib/forms/guard.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { errorText, formProblem } from '$lib/tables/form-values';
  import { toast } from '$lib/toaster';

  let { data, form = null } = $props();

  type Values = {
    url: string;
    name: string;
    owner: string;
    startsOn: string;
    endsOn: string;
    image?: File;
  };
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
  const controller = actionForm<Values>({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
    schema: crowdfundingFormSchema,
    onSuccess: () => toast.success(m.crowdfunding_form_published()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);
  const { draft } = controller;

  const locale = getLocale();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

  const text = (code: string, field: string) => {
    if (field === 'url' && (code === 'invalid_url' || code === 'invalid_format')) {
      return m.crowdfunding_err_invalid_url();
    }
    if (field === 'url' && code === 'already_listed') return m.crowdfunding_err_already_listed();
    if (field === 'url' && code === 'too_big') return m.crowdfunding_err_invalid_url();
    if ((field === 'startsOn' || field === 'endsOn') && code === 'invalid') {
      return m.crowdfunding_err_date();
    }
    if (code === 'too_small') return m.form_error_required();
    return errorText(code, field);
  };
  const err = (field: keyof Values) => {
    const code = controller.errors[field]?.[0];
    return code ? text(code, field) : undefined;
  };
  const imageError = $derived(
    err('image') ??
      (controller.message?.field === 'image'
        ? errorText(controller.message.code, 'image')
        : undefined),
  );
  const invalid = (field: keyof Values) => (controller.errors[field]?.[0] ? 'true' : undefined);
  const problem = $derived(formProblem(controller.message));
  const summary = $derived(
    (
      [
        ['url', m.crowdfunding_form_url()],
        ['name', m.crowdfunding_form_name()],
        ['owner', m.crowdfunding_form_owner()],
        ['startsOn', m.crowdfunding_form_starts()],
        ['endsOn', m.crowdfunding_form_ends()],
      ] as const
    ).flatMap(([field, label]) => {
      const message = err(field);
      return message ? [{ id: field, label, message }] : [];
    }),
  );
  const problems = $derived(
    imageError
      ? [...summary, { id: 'image', label: m.crowdfunding_form_image(), message: imageError }]
      : summary,
  );

  // Once a link is typed, the page's title fills the name (when the member has not typed one). The
  // server reads the page, never the browser; if it cannot, the name is simply left to the member.
  let reading = $state(false);
  let named = $state(false);
  let lookup = 0;
  async function readLink() {
    const link = normalizeCampaignUrl($draft.url);
    if (!link) return;
    const mine = ++lookup;
    reading = true;
    try {
      const response = await fetch(
        `${localizedHref('/crowdfunding/preview', locale)}?url=${encodeURIComponent(link)}`,
      );
      const body: { title: string | null } = response.ok ? await response.json() : { title: null };
      // A later link, or a name typed meanwhile, wins over this answer.
      if (mine !== lookup || $draft.name.trim() || !body.title) return;
      controller.change('name', body.title.slice(0, CROWDFUNDING_LIMITS.name));
      named = true;
    } catch {
      // The page could not be read: the member types the name.
    } finally {
      if (mine === lookup) reading = false;
    }
  }

  const link = $derived(normalizeCampaignUrl($draft.url));
  const preview = $derived({
    id: 'preview',
    name: $draft.name || m.crowdfunding_form_name(),
    owner: $draft.owner || m.crowdfunding_form_owner(),
    url: link ?? 'https://example.com',
    platform: platformOf(link ?? ''),
    startsOn: $draft.startsOn || today,
    endsOn: $draft.endsOn || $draft.startsOn || today,
    imageUrl: null,
    submitter: data.account?.username ?? '',
  });
</script>

<svelte:head>
  <title>{m.crowdfunding_new_title()}</title>
</svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[
      { label: m.nav_crowdfunding_label(), href: '/crowdfunding' },
      { label: m.crowdfunding_new_title() },
    ]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.crowdfunding_new_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {m.crowdfunding_new_lede()}
  </p>

  <Form
    enctype="multipart/form-data"
    onsubmit={controller.submit}
    onfocusout={controller.blur}
    class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12"
  >
    <div class="grid gap-8 lg:col-span-2">
      <ErrorSummary errors={problems} />
      <FormBanner text={problem} />

      <section
        aria-labelledby="campaign-section"
        class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
      >
        <h2 id="campaign-section" class="mb-6 text-2xl font-semibold tracking-tight">
          {m.crowdfunding_title()}
        </h2>
        <div class="grid gap-6">
          <FormField
            id="url"
            label={m.crowdfunding_form_url()}
            hint={m.crowdfunding_form_url_hint()}
            error={err('url')}
          >
            {#snippet children(aria)}
              <TextInput
                id="url"
                name="url"
                type="url"
                inputmode="url"
                autocomplete="off"
                required
                maxlength={CROWDFUNDING_LIMITS.url}
                bind:value={$draft.url}
                onchange={readLink}
                class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
                {...aria}
              />
            {/snippet}
          </FormField>
          <FormField
            id="name"
            label={m.crowdfunding_form_name()}
            hint={m.crowdfunding_form_name_hint({ max: CROWDFUNDING_LIMITS.name })}
            error={err('name')}
            counter={{ count: $draft.name.length, max: CROWDFUNDING_LIMITS.name }}
          >
            {#snippet children(aria)}
              <TextInput
                id="name"
                name="name"
                required
                maxlength={CROWDFUNDING_LIMITS.name}
                bind:value={$draft.name}
                oninput={() => (named = false)}
                class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
                {...aria}
              />
              <p role="status" class="mt-1 text-sm text-muted">
                {#if reading}{m.crowdfunding_form_reading()}{:else if named}{m.crowdfunding_form_name_read()}{/if}
              </p>
            {/snippet}
          </FormField>
          <FormField
            id="owner"
            label={m.crowdfunding_form_owner()}
            hint={m.crowdfunding_form_owner_hint({ max: CROWDFUNDING_LIMITS.owner })}
            error={err('owner')}
            counter={{ count: $draft.owner.length, max: CROWDFUNDING_LIMITS.owner }}
          >
            {#snippet children(aria)}
              <TextInput
                id="owner"
                name="owner"
                required
                maxlength={CROWDFUNDING_LIMITS.owner}
                bind:value={$draft.owner}
                class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
                {...aria}
              />
            {/snippet}
          </FormField>
          <div class="grid gap-6 sm:grid-cols-2">
            <div class="min-w-0">
              <DateTimeField
                id="startsOn"
                name="startsOn"
                label={m.crowdfunding_form_starts()}
                required
                bind:value={$draft.startsOn}
                invalid={!!invalid('startsOn')}
                describedby={err('startsOn') ? 'startsOn-error' : undefined}
              />
              {#if err('startsOn')}<p
                  id="startsOn-error"
                  role="alert"
                  class="mt-1 text-sm font-semibold text-error-700-300"
                >
                  {err('startsOn')}
                </p>{/if}
            </div>
            <div class="min-w-0">
              <DateTimeField
                id="endsOn"
                name="endsOn"
                label={m.crowdfunding_form_ends()}
                required
                min={$draft.startsOn || today}
                bind:value={$draft.endsOn}
                invalid={!!invalid('endsOn')}
                describedby={err('endsOn') ? 'endsOn-error' : undefined}
              />
              {#if err('endsOn')}<p
                  id="endsOn-error"
                  role="alert"
                  class="mt-1 text-sm font-semibold text-error-700-300"
                >
                  {err('endsOn')}
                </p>{/if}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="image-section"
        class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
      >
        <h2 id="image-section" class="mb-6 text-2xl font-semibold tracking-tight">
          {m.crowdfunding_form_image()}
        </h2>
        <ImageUpload
          id="image"
          name="image"
          label="{m.crowdfunding_form_image()} ({m.form_optional()})"
          hint={m.crowdfunding_form_image_hint()}
          error={imageError}
          onpick={(files) => {
            controller.change('image', files[0]);
            controller.validateField('image');
          }}
        />
      </section>

      <div class="flex flex-wrap items-center gap-5">
        <SubmitButton
          submitting={controller.pending}
          delayed={controller.delayed}
          timeout={controller.timeout}
          class="btn h-12 rounded-lg preset-filled-primary-500 px-7 font-semibold"
          >{m.crowdfunding_form_submit()}</SubmitButton
        >
        <a
          href={localizedHref('/crowdfunding', locale)}
          class="link-underline font-semibold text-link">{m.form_cancel()}</a
        >
      </div>
    </div>
    <aside aria-labelledby="preview-title" class="lg:sticky lg:top-6 lg:self-start">
      <p id="preview-title" class="text-sm font-bold tracking-wider text-muted uppercase">
        {m.form_preview()}
      </p>
      <!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
      <div class="mt-3" inert>
        <CrowdfundingCard campaign={preview} />
      </div>
    </aside>
  </Form>
</section>
