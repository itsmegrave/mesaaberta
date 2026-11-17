<script lang="ts">
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { page } from '$app/state';
  import { m } from '#lib/paraglide/messages.js';

  // The server sends a status and, where it helps, a `code`; the words are chosen here.
  const concluded = $derived(page.error?.code === 'table_concluded' && !!page.params.slug);
  const title = $derived(
    concluded
      ? m.error_table_concluded_title()
      : page.status === 404
        ? m.error_not_found_title()
        : page.status === 403
          ? m.error_forbidden_title()
          : m.error_generic_title(),
  );
  const text = $derived(
    concluded
      ? m.error_table_concluded_text()
      : page.status === 404
        ? m.error_not_found_text()
        : page.status === 403
          ? m.error_forbidden_text()
          : m.error_generic_text(),
  );
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<section class="py-16 md:py-24">
  <h1 class="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
  <p class="mt-4 max-w-md text-lg">{text}</p>
  {#if concluded}
    <a
      href={`/t/${page.params.slug}/manage`}
      class="mt-6 {buttonClass('primary', 'md')} font-semibold"
    >
      {m.error_table_concluded_manage()}
    </a>
  {:else}
    <a href="/" class="mt-6 {buttonClass('primary', 'md')} font-semibold">
      {m.error_back_home()}
    </a>
  {/if}
</section>
