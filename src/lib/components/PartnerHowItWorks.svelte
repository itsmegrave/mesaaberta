<script lang="ts">
  // "Como funciona": the three steps of the link exchange, our link to copy and the button to send a
  // partner. The partner is listed after an admin approves it, and the note says what can take it off.
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { OUR_LINK } from '$lib/partners/our-link';
  import { toast } from '$lib/toaster';

  const locale = getLocale();
  const steps = $derived([
    { title: m.partner_step1_title(), text: m.partner_step1_text() },
    { title: m.partner_step2_title(), text: m.partner_step2_text() },
    { title: m.partner_step3_title(), text: m.partner_step3_text() },
  ]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(OUR_LINK);
      toast.success(m.toast_link_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
</script>

<section
  aria-labelledby="partner-how"
  class="mt-8 grid gap-6 rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8 lg:grid-cols-3 lg:gap-10"
>
  <div class="grid gap-4 lg:col-span-2">
    <div>
      <h2 id="partner-how" class="text-2xl font-semibold tracking-tight">
        {m.partner_how_title()}
      </h2>
      <p class="mt-1 text-muted">{m.partner_how_lede()}</p>
    </div>
    <ol class="grid gap-4 sm:grid-cols-3">
      {#each steps as step, index (step.title)}
        <li class="grid gap-1">
          <span
            class="flex size-8 items-center justify-center rounded-full preset-filled-primary-500 text-sm font-bold"
            aria-hidden="true">{index + 1}</span
          >
          <p class="font-semibold">{step.title}</p>
          <p class="text-sm text-muted">{step.text}</p>
        </li>
      {/each}
    </ol>
    <p class="text-sm text-muted">{m.partner_how_note()}</p>
  </div>

  <div class="grid content-start gap-4 rounded-lg bg-surface-wash p-4">
    <div class="grid gap-1">
      <p class="label-text font-semibold">{m.partner_our_link()}</p>
      <div class="flex items-center justify-between gap-2">
        <code class="min-w-0 truncate font-mono text-sm">{OUR_LINK}</code>
        <button
          type="button"
          class="btn h-11 shrink-0 gap-2 rounded-lg border-2 border-surface-200-800 px-3 font-semibold hover:preset-tonal"
          onclick={() => void copy()}
        >
          <Icon name="copy" size={18} />{m.partner_copy()}
        </button>
      </div>
    </div>
    <a
      href={localizedHref('/partners/new', locale)}
      class="btn h-12 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
    >
      <Icon name="plus" size={20} />
      {m.partner_add_cta()}
    </a>
  </div>
</section>
