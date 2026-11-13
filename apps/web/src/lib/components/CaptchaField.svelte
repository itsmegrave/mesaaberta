<script lang="ts">
  import { captchaWidget } from './captcha.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  // `resetOn` changes after each answer from the server, so the next submit gets a fresh token.
  let { siteKey, resetOn }: { siteKey: string; resetOn?: unknown } = $props();

  // svelte-ignore state_referenced_locally
  const widget = captchaWidget(siteKey);

  $effect(() => {
    void resetOn;
    widget.reset();
  });
</script>

<div {@attach widget.attach} class="min-h-16"></div>
{#if widget.failed}
  <p role="alert" class="text-sm text-muted">{m.auth_captcha_unavailable()}</p>
{/if}
