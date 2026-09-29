<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  /**
   * A form's submit button. Pass Superforms' `$submitting`, `$delayed` (after `delayMs`, 500 ms by
   * default) and `$timeout` (after `timeoutMs`, 8 s). From the moment the form is sent a second click
   * does nothing; a spinner shows once the submit is slow, and a note once it is very slow. While
   * busy it is `aria-disabled`, not `disabled`, so it keeps its focus and its place in the tab order.
   */
  let {
    submitting = false,
    delayed = false,
    timeout = false,
    class: className = '',
    children,
  }: {
    submitting?: boolean;
    delayed?: boolean;
    timeout?: boolean;
    class?: string;
    children: Snippet;
  } = $props();

  const ignoreWhileBusy = (event: MouseEvent) => {
    if (submitting || delayed) event.preventDefault();
  };
</script>

<button
  type="submit"
  class="gap-2 {className}"
  aria-busy={delayed || undefined}
  aria-disabled={delayed || undefined}
  onclick={ignoreWhileBusy}
>
  {#if delayed}
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      class="shrink-0 motion-safe:animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  {/if}
  {#if timeout}{m.form_still_saving()}{:else}{@render children()}{/if}
</button>
