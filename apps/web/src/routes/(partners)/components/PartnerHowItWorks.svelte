<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { copyText } from '#lib/clipboard.js';
  // "Como funciona": the three steps of the link exchange, our link to copy and the button to send a
  // partner. The partner is listed after an admin approves it, and the note says what can take it off.
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';

  import { page as appPage } from '$app/state';

  // The address a partner puts on their site, bio or Discord: the "troca de links" (link exchange).
  const ourLink = $derived(appPage.data.site?.APP_ORIGIN ?? '');

  const steps = $derived([
    { title: m.partner_step1_title(), text: m.partner_step1_text() },
    { title: m.partner_step2_title(), text: m.partner_step2_text() },
    { title: m.partner_step3_title(), text: m.partner_step3_text() },
  ]);

  function copy() {
    return copyText(ourLink, m.toast_link_copied());
  }
</script>

<section
  aria-labelledby="partner-how"
  class="mt-8 flex flex-col gap-6 rounded-lg border border-surface-200-800 bg-panel p-5 md:p-7 lg:flex-row lg:gap-8"
>
  <div class="flex min-w-0 flex-1 flex-col gap-5">
    <div class="flex items-center gap-3">
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-lg preset-filled-primary-500"
        aria-hidden="true"><Icon name="game-icons:shaking-hands" size={24} /></span
      >
      <div>
        <h2 id="partner-how" class="text-2xl leading-tight font-semibold tracking-tight">
          {m.partner_how_title()}
        </h2>
        <p class="mt-0.5 text-muted">{m.partner_how_lede()}</p>
      </div>
    </div>
    <ol class="grid gap-4 md:grid-cols-3 md:gap-6">
      {#each steps as step, index (step.title)}
        <li class="flex items-start gap-3">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-sm font-bold"
            aria-hidden="true">{index + 1}</span
          >
          <span>
            <span class="block leading-snug font-semibold">{step.title}</span>
            <span class="mt-0.5 block text-sm text-muted">{step.text}</span>
          </span>
        </li>
      {/each}
    </ol>
    <p class="text-xs text-muted">{m.partner_how_note()}</p>
  </div>

  <div
    class="flex shrink-0 flex-col justify-between gap-4 border-surface-200-800 max-lg:border-t max-lg:pt-6 lg:w-90 lg:border-l lg:pl-8"
  >
    <div class="grid gap-2">
      <p class="text-sm font-semibold">{m.partner_our_link()}</p>
      <div class="flex items-center gap-2">
        <code
          class="flex h-11 min-w-0 flex-1 items-center truncate rounded-lg border border-surface-200-800 bg-panel px-3 font-mono text-sm"
          >{ourLink}</code
        >
        <MAButton
          size="custom"
          class="btn h-11 shrink-0 gap-2 rounded-lg btn-secondary px-3 text-sm font-semibold"
          onclick={() => void copy()}
        >
          <Icon name="copy" size={16} />{m.partner_copy()}
        </MAButton>
      </div>
      <p class="text-xs text-muted">{m.partner_our_link_hint()}</p>
    </div>
    <a
      href="/partners/new"
      class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
    >
      <Icon name="plus" size={20} />
      {m.partner_add_cta()}
    </a>
  </div>
</section>
